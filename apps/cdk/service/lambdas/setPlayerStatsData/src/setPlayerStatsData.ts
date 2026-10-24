import { Context, EventBridgeEvent, Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import {
	PLAYER_STATS_PK,
	SNAPSHOT_INTERVAL_MINUTES,
	SNAPSHOT_STOP_AFTER_MINUTES,
	SeasonStats,
	validateCareer,
} from "utilities/player-stats";
import { currentSeasonStartYear } from "utilities/season";

const {
	BBREF_BASE_URL = "",
	MAIN_TABLE_NAME = "",
	staticDataBucket = "",
} = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client();

// BBRef blocks above 20 requests a minute; start-to-start spacing keeps us at
// ~17 however slow a response is.
export const REQUEST_INTERVAL_MS = 3_500;
export const FETCH_TIMEOUT_MS = 10_000;
// Stop starting scrapes with this much of the Lambda's time left; the rest
// waits for the next run.
export const STOP_WITH_REMAINING_MS = 60_000;
// Current players' careers change every week of the season.
export const ACTIVE_REFRESH_SECONDS = 7 * 24 * 60 * 60;
// A retired career only changes if BBRef corrects it.
export const INACTIVE_REFRESH_SECONDS = 90 * 24 * 60 * 60;
export const RETRY_FAILED_SECONDS = 24 * 60 * 60;
// BBRef jails a client "for up to a day".
export const BLOCKED_COOLDOWN_SECONDS = 24 * 60 * 60;
// Marks a lastError left by a block, so a later 403 or page without player
// info from the same player reads as his page, not a jail. A stored 429 says
// nothing about his page, so it doesn't count.
export const BLOCKED_PREFIX = "blocked: ";
export const RATE_LIMITED_ERROR = `${BLOCKED_PREFIX}BBRef returned 429`;
// This many failures in a row means BBRef or its markup changed, not the players.
export const MAX_CONSECUTIVE_FAILURES = 5;
export const FAILURES_COOLDOWN_SECONDS = 60 * 60;
export const RUN_CONTROL_KEY = { PK: "PLAYERSTATS_RUN", SK: "state" };
export const SHRINK_CONDITION = "attribute_not_exists(#stats) OR size(#stats) <= :seasons";
export const FAILED_UPDATE = "SET #checkedAt = :now, #lastError = :error REMOVE #ttl, #freshUntil";
// One run at a time: EventBridge delivers at least once, and a console
// test-invoke can land mid-run; two runs would double the BBRef rate.
export const LEASE_UPDATE = "SET #runningUntil = :until";
export const LEASE_CONDITION = "attribute_not_exists(#runningUntil) OR #runningUntil <= :now";
export const RELEASE_UPDATE = "REMOVE #runningUntil";
export const PAUSE_UPDATE = "SET #cooldownUntil = :until, #reason = :reason";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isConditionFailure = (err: unknown) =>
	(err as Error)?.name === "ConditionalCheckFailedException";

const num = (v: string): number => {
	const n = parseFloat(v);
	return Number.isFinite(n) ? n : 0;
};

// Parse the per_game_stats table into the BALLDONTLIE season_averages shape the
// frontend already consumes. BBRef percentages are already fractions (0.515).
// null means the page isn't a player page at all (a rate-limit or interstitial
// served as a 200), which is a failure rather than an empty career.
export const parseCareer = (html: string): SeasonStats[] | null => {
	const $ = cheerio.load(html);
	if ($("#meta").length === 0) return null;
	const seenSeasons = new Set<number>();
	const out: SeasonStats[] = [];

	$("#per_game_stats tbody tr").each((_, tr) => {
		const $tr = $(tr);
		if (($tr.attr("class") || "").includes("thead")) return;

		const yearText = $tr.find('[data-stat="year_id"]').text().trim();
		const season = parseInt(yearText.split("-")[0], 10); // "2003-04" -> 2003
		if (!Number.isFinite(season)) return; // Career/summary rows
		if (seenSeasons.has(season)) return; // first row = combined multi-team
		seenSeasons.add(season);

		const td = (stat: string) =>
			$tr.find(`td[data-stat="${stat}"]`).text().trim();

		out.push({
			season,
			games_played: num(td("games")),
			min: num(td("mp_per_g")),
			fgm: num(td("fg_per_g")),
			fga: num(td("fga_per_g")),
			fg_pct: num(td("fg_pct")),
			fg3m: num(td("fg3_per_g")),
			fg3a: num(td("fg3a_per_g")),
			fg3_pct: num(td("fg3_pct")),
			ftm: num(td("ft_per_g")),
			fta: num(td("fta_per_g")),
			ft_pct: num(td("ft_pct")),
			oreb: num(td("orb_per_g")),
			dreb: num(td("drb_per_g")),
			reb: num(td("trb_per_g")),
			ast: num(td("ast_per_g")),
			stl: num(td("stl_per_g")),
			blk: num(td("blk_per_g")),
			turnover: num(td("tov_per_g")),
			pf: num(td("pf_per_g")),
			pts: num(td("pts_per_g")),
		});
	});

	// Most recent season first (frontend reads playerStats[0] as latest).
	return out.sort((a, b) => b.season - a.season);
};

export class BlockedError extends Error {
	name = "BlockedError";

	constructor(
		message: string,
		readonly rateLimited = false,
	) {
		super(message);
	}
}

// Runs fire at :00/:20/:40 UTC. However late one starts (a throttled async
// start, a duplicate delivery, a console test-invoke), it makes no request
// past SNAPSHOT_STOP_AFTER_MINUTES into its slot, so it never overlaps
// setPlayersData's :14 slot.
export const slotEndMs = (nowMs: number): number => {
	const slotMs = SNAPSHOT_INTERVAL_MINUTES * 60_000;
	return Math.floor(nowMs / slotMs) * slotMs + SNAPSHOT_STOP_AFTER_MINUTES * 60_000;
};

export const scrapeCareer = async (playerId: string): Promise<SeasonStats[]> => {
	const url = `${BBREF_BASE_URL}/players/${playerId[0]}/${playerId}.html`;
	const response = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (compatible; TeamBuilder/1.0)",
		},
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (response.status === 429 || response.status === 403) {
		throw new BlockedError(`BBRef returned ${response.status}`, response.status === 429);
	}
	// 404 included: ids come from BBRef's own index, so a missing page is a
	// failure, not an empty career.
	if (!response.ok) {
		throw new Error(`BBRef returned ${response.status} ${response.statusText}`);
	}

	const stats = parseCareer(await response.text());
	// BBRef serves a rate-limit or interstitial page as a 200; every id comes
	// from its own index, so a real player page always has #meta.
	if (stats === null) throw new BlockedError("BBRef returned a page without player info");
	return stats;
};

export interface PoolPlayer {
	id: string;
	active: boolean;
}

export interface SnapshotEntry {
	checkedAt?: number;
	lastError?: string;
	failed?: boolean;
}

// Missing careers first (current players, then rated legends, then the rest),
// then careers the old cache left behind, then due refreshes, oldest first.
export const planRun = (
	players: PoolPlayer[],
	rated: Set<string>,
	entries: Map<string, SnapshotEntry>,
	nowS: number,
): string[] => {
	const due: { id: string; rank: number; checkedAt: number }[] = [];
	for (const { id, active } of players) {
		const entry = entries.get(id);
		if (!entry || (entry.checkedAt === undefined && entry.failed)) {
			due.push({ id, rank: active ? 0 : rated.has(id) ? 1 : 2, checkedAt: 0 });
		} else if (entry.checkedAt === undefined) {
			due.push({ id, rank: 3, checkedAt: 0 });
		} else {
			const every = entry.lastError
				? RETRY_FAILED_SECONDS
				: active
					? ACTIVE_REFRESH_SECONDS
					: INACTIVE_REFRESH_SECONDS;
			if (entry.checkedAt + every <= nowS) {
				due.push({ id, rank: 4, checkedAt: entry.checkedAt });
			}
		}
	}
	return due
		.sort((a, b) => a.rank - b.rank || a.checkedAt - b.checkedAt || a.id.localeCompare(b.id))
		.map((d) => d.id);
};

const readJson = async (key: string): Promise<any> => {
	const { Body } = await s3Client.send(
		new GetObjectCommand({ Bucket: staticDataBucket, Key: key }),
	);
	return JSON.parse(await Body!.transformToString());
};

// Errors propagate: there is nothing to plan without the pool.
const loadPlayers = async (): Promise<PoolPlayer[]> => {
	const parsed = await readJson("players.json");
	if (!Array.isArray(parsed?.data)) throw new Error("players.json has no data array");
	return parsed.data.map((p: { id: string; active?: boolean }) => ({ id: p.id, active: !!p.active }));
};

// Ratings only order the backfill, so a missing file isn't a failure.
const loadRatedIds = async (): Promise<Set<string>> => {
	try {
		const parsed = await readJson("player-ratings.json");
		return new Set(Object.keys(parsed?.data ?? {}));
	} catch (err) {
		console.error("Failed to read player-ratings.json", err);
		return new Set();
	}
};

const loadEntries = async (): Promise<Map<string, SnapshotEntry>> => {
	const entries = new Map<string, SnapshotEntry>();
	let ExclusiveStartKey: Record<string, unknown> | undefined;
	do {
		const page = await docClient.send(
			new QueryCommand({
				TableName: MAIN_TABLE_NAME,
				KeyConditionExpression: "PK = :pk",
				ExpressionAttributeValues: { ":pk": PLAYER_STATS_PK },
				ProjectionExpression: "#sk, #checkedAt, #lastError, #failed",
				ExpressionAttributeNames: {
					"#sk": "SK",
					"#checkedAt": "checkedAt",
					"#lastError": "lastError",
					"#failed": "failed",
				},
				ExclusiveStartKey,
			}),
		);
		for (const item of page.Items ?? []) {
			entries.set(item.SK, {
				checkedAt: item.checkedAt,
				lastError: item.lastError,
				failed: item.failed,
			});
		}
		ExclusiveStartKey = page.LastEvaluatedKey;
	} while (ExclusiveStartKey);
	return entries;
};

// Careers never shrink, so fewer seasons than stored means a damaged page and
// the stored career stays. The Put replaces the whole item, which drops a
// legacy `ttl`/`freshUntil`/`failed`.
const saveCareer = async (id: string, stats: SeasonStats[], nowS: number): Promise<boolean> => {
	try {
		await docClient.send(
			new PutCommand({
				TableName: MAIN_TABLE_NAME,
				Item: { PK: PLAYER_STATS_PK, SK: id, stats, scrapedAt: nowS, checkedAt: nowS },
				ConditionExpression: SHRINK_CONDITION,
				ExpressionAttributeNames: { "#stats": "stats" },
				ExpressionAttributeValues: { ":seasons": stats.length },
			}),
		);
		return true;
	} catch (err) {
		if (isConditionFailure(err)) return false;
		throw err;
	}
};

// Keeps any stored career and removes the legacy `ttl`, so DynamoDB never
// deletes the last good copy.
const markFailed = async (id: string, error: string, nowS: number) => {
	await docClient.send(
		new UpdateCommand({
			TableName: MAIN_TABLE_NAME,
			Key: { PK: PLAYER_STATS_PK, SK: id },
			UpdateExpression: FAILED_UPDATE,
			ExpressionAttributeNames: {
				"#checkedAt": "checkedAt",
				"#lastError": "lastError",
				"#ttl": "ttl",
				"#freshUntil": "freshUntil",
			},
			ExpressionAttributeValues: { ":now": nowS, ":error": error.slice(0, 500) },
		}),
	);
};

// An Update, so it leaves the lease alone.
const pause = async (seconds: number, reason: string, nowS: number) => {
	await docClient.send(
		new UpdateCommand({
			TableName: MAIN_TABLE_NAME,
			Key: RUN_CONTROL_KEY,
			UpdateExpression: PAUSE_UPDATE,
			ExpressionAttributeNames: { "#cooldownUntil": "cooldownUntil", "#reason": "reason" },
			ExpressionAttributeValues: { ":until": nowS + seconds, ":reason": reason },
		}),
	);
};

interface RunControl {
	cooldownUntil?: number;
	reason?: string;
	runningUntil?: number;
}

// The control item once this run holds the lease, or null if another run does.
const acquireRun = async (nowS: number, untilS: number): Promise<RunControl | null> => {
	try {
		const { Attributes } = await docClient.send(
			new UpdateCommand({
				TableName: MAIN_TABLE_NAME,
				Key: RUN_CONTROL_KEY,
				UpdateExpression: LEASE_UPDATE,
				ConditionExpression: LEASE_CONDITION,
				ExpressionAttributeNames: { "#runningUntil": "runningUntil" },
				ExpressionAttributeValues: { ":until": untilS, ":now": nowS },
				ReturnValues: "ALL_NEW",
			}),
		);
		return (Attributes ?? {}) as RunControl;
	} catch (err) {
		if (isConditionFailure(err)) return null;
		throw err;
	}
};

const releaseRun = async () => {
	await docClient.send(
		new UpdateCommand({
			TableName: MAIN_TABLE_NAME,
			Key: RUN_CONTROL_KEY,
			UpdateExpression: RELEASE_UPDATE,
			ExpressionAttributeNames: { "#runningUntil": "runningUntil" },
		}),
	);
};

type StopReason = "done" | "budget" | "blocked" | "failures" | "cooldown" | "running";

interface RunSummary {
	due: number;
	attempted: number;
	saved: number;
	failed: number;
	stoppedBy: StopReason;
}

const report = (summary: RunSummary) => {
	console.log(JSON.stringify(summary));
	return { statusCode: 200, body: JSON.stringify(summary) };
};

const snapshot = async (control: RunControl, startS: number, context: Context) => {
	if ((control.cooldownUntil ?? 0) > startS) {
		console.log(
			`Paused until ${new Date(control.cooldownUntil! * 1000).toISOString()}: ${control.reason}`,
		);
		return report({ due: 0, attempted: 0, saved: 0, failed: 0, stoppedBy: "cooldown" });
	}

	const [players, rated, entries] = await Promise.all([
		loadPlayers(),
		loadRatedIds(),
		loadEntries(),
	]);
	const due = planRun(players, rated, entries, startS);
	const activeById = new Map(players.map((p) => [p.id, p.active]));
	const latestSeason = currentSeasonStartYear();
	const stopAtMs = slotEndMs(Date.now());

	let attempted = 0;
	let saved = 0;
	let failed = 0;
	let inARow = 0;
	let lastStart = 0;
	let stoppedBy: StopReason = "done";

	for (const id of due) {
		if (context.getRemainingTimeInMillis() < STOP_WITH_REMAINING_MS) {
			stoppedBy = "budget";
			break;
		}
		// Checked against when this request would start, after the pacing wait.
		const startAt = Math.max(Date.now(), lastStart + REQUEST_INTERVAL_MS);
		if (startAt + FETCH_TIMEOUT_MS > stopAtMs) {
			stoppedBy = "budget";
			break;
		}
		const wait = startAt - Date.now();
		if (wait > 0) await sleep(wait);
		lastStart = Date.now();
		attempted++;
		const nowS = Math.floor(lastStart / 1000);

		let problem: string | null;
		let stats: SeasonStats[] = [];
		try {
			stats = await scrapeCareer(id);
			problem = validateCareer(stats, latestSeason, activeById.get(id) ?? false);
		} catch (err) {
			if (err instanceof BlockedError) {
				problem = `${BLOCKED_PREFIX}${err.message}`;
				// A 403 or page without player info from a player whose last error
				// was also one of those is his page, not a jail: fall through as an
				// ordinary failure (retried daily), so one bad page can't stall the
				// whole snapshot every day. A 429 is always the client being limited.
				const last = entries.get(id)?.lastError;
				const repeat = !!last?.startsWith(BLOCKED_PREFIX) && last !== RATE_LIMITED_ERROR;
				if (err.rateLimited || !repeat) {
					// The pause goes first: if a write fails after it, the run still
					// stops for a day.
					await pause(BLOCKED_COOLDOWN_SECONDS, `${err.message} for ${id}`, nowS);
					// Charged to the player too, so after the cooldown he waits his
					// turn behind the missing careers instead of going first again.
					await markFailed(id, problem, nowS);
					failed++;
					stoppedBy = "blocked";
					break;
				}
			} else {
				problem = err instanceof Error ? err.message : String(err);
			}
		}
		if (!problem && !(await saveCareer(id, stats, nowS))) {
			problem = "fewer seasons than the stored career";
		}
		if (!problem) {
			saved++;
			inARow = 0;
			continue;
		}

		console.error(`Keeping the stored career for ${id}: ${problem}`);
		await markFailed(id, problem, nowS);
		failed++;
		if (++inARow >= MAX_CONSECUTIVE_FAILURES) {
			await pause(
				FAILURES_COOLDOWN_SECONDS,
				`${inARow} failures in a row, last ${id}: ${problem}`,
				nowS,
			);
			stoppedBy = "failures";
			break;
		}
	}

	return report({ due: due.length, attempted, saved, failed, stoppedBy });
};

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context,
): Promise<any> => {
	console.log(JSON.stringify({ event }, null, 4));

	const startS = Math.floor(Date.now() / 1000);
	// The lease lasts this invocation's whole time limit, so a run that dies
	// without releasing it frees it before the next slot.
	const control = await acquireRun(
		startS,
		startS + Math.ceil(context.getRemainingTimeInMillis() / 1000),
	);
	if (!control) {
		console.log("Another run holds the lease");
		return report({ due: 0, attempted: 0, saved: 0, failed: 0, stoppedBy: "running" });
	}
	try {
		return await snapshot(control, startS, context);
	} finally {
		await releaseRun();
	}
};
