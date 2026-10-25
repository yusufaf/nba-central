import { Handler } from "aws-lambda";
import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import type {
	HeadshotEntry,
	HeadshotsFile,
	RosterAthlete,
	ScheduleFile,
	ScheduleGame,
	StandingsFile,
} from "models/live-data";
import {
	CONFERENCES,
	TEAMS_PER_CONFERENCE,
	headshotsShrinkReason,
	isNonEmptyString,
	parseRoster,
	parseScoreboardDay,
	parseStandings,
	pickHeadshotsToMirror,
	scheduleDates,
	scheduleShrinkReason,
} from "utilities/espn";
import {
	HEADSHOTS_KEY,
	HEADSHOT_CACHE_CONTROL,
	LIVE_JSON_CACHE_CONTROL,
	SCHEDULE_KEY,
	STANDINGS_KEY,
	headshotKey,
	headshotPath,
} from "utilities/live-data";
import {
	indexByName,
	normalizeName,
	resolveMatch,
	toTotalInches,
	type PoolPlayer,
} from "utilities/player-names";
import { isRecord } from "utilities/type-guards";

/**
 * Hourly: copies ESPN's standings and a week of schedule into live/ in the
 * assets bucket, and once a day joins ESPN's rosters to the BBRef players so
 * their headshots can be mirrored there too, a batch per run. The web reads
 * only those files, so no visitor ever reaches ESPN. Every dataset is
 * validated on its own, and one that fails keeps its previous file.
 */

const {
	ESPN_API_BASE_URL = "",
	ESPN_STANDINGS_URL = "",
	ESPN_HEADSHOT_BASE_URL = "",
	assetsBucket = "",
	staticDataBucket = "",
} = process.env;

const s3Client = new S3Client();

// ESPN's site API turns away clients that don't look like a browser.
export const ESPN_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
// Start-to-start, like setPlayerStatsData. A first run is about 140 requests.
export const ESPN_REQUEST_INTERVAL_MS = 500;
export const FETCH_TIMEOUT_MS = 10_000;
// Rosters change through trades and signings, not by the hour.
export const ROSTERS_EVERY_SECONDS = 23 * 3600;
export const HEADSHOT_BATCH = 100;
export const MIN_IMAGE_BYTES = 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const STOP_WITH_REMAINING_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

// An unread body holds its connection until garbage collection.
const release = async (res: Response) => {
	if (res.bodyUsed) return;
	try {
		await res.body?.cancel();
	} catch {
		// Already closed or errored.
	}
};

// ---- S3 ----

type Previous<T> =
	| { state: "missing" }
	| { state: "ok"; value: T }
	// "read": S3 failed, maybe for a moment. "corrupt": the object isn't a
	// version 1 file of the shape this code writes - a bad write, or a file
	// from a deploy that wrote a different shape.
	| { state: "unreadable"; cause: "read" | "corrupt"; reason: string };

// Only NoSuchKey means there is no previous file. Anything else is reported
// as unreadable, so a transient S3 error is never mistaken for a first run.
// A file is checked against the shape this Lambda writes, since every later
// step trusts it.
const readLiveJson = async <T>(
	key: string,
	isValid: (value: Record<string, unknown>) => boolean,
): Promise<Previous<T>> => {
	let raw: string;
	try {
		const { Body } = await s3Client.send(
			new GetObjectCommand({ Bucket: assetsBucket, Key: key }),
		);
		raw = await Body!.transformToString();
	} catch (err) {
		if (isRecord(err) && err.name === "NoSuchKey") return { state: "missing" };
		console.error(`Couldn't read ${key}`, err);
		return { state: "unreadable", cause: "read", reason: message(err) };
	}
	try {
		const value: unknown = JSON.parse(raw);
		if (isRecord(value) && value.version === 1 && isValid(value)) {
			return { state: "ok", value: value as T };
		}
	} catch {
		// Reported below.
	}
	console.error(`${key} is not a valid version 1 file`);
	return { state: "unreadable", cause: "corrupt", reason: "not a valid version 1 file" };
};

const isString = (value: unknown): value is string => typeof value === "string";
const isNullable = <T>(is: (value: unknown) => value is T) => (value: unknown) =>
	value === null || is(value);
const isNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

// All 30 teams with their ids: a fallback for the roster rebuild must be the
// whole league, or the rebuild would be charged for a partial one.
const isStandingsFile = (value: Record<string, unknown>) => {
	if (!Array.isArray(value.conferences) || value.conferences.length !== CONFERENCES.length) {
		return false;
	}
	const ids = new Set<string>();
	for (const conference of value.conferences) {
		if (!isRecord(conference) || !Array.isArray(conference.teams)) return false;
		if (conference.teams.length !== TEAMS_PER_CONFERENCE) return false;
		for (const team of conference.teams) {
			if (!isRecord(team) || !isNonEmptyString(team.espnId)) return false;
			if (!isNonEmptyString(team.abbreviation)) return false;
			ids.add(team.espnId);
		}
	}
	return ids.size === CONFERENCES.length * TEAMS_PER_CONFERENCE;
};

const isScheduleFile = (value: Record<string, unknown>) =>
	Array.isArray(value.dates) &&
	Array.isArray(value.games) &&
	value.games.every(
		(game) =>
			isRecord(game) &&
			isNonEmptyString(game.id) &&
			isString(game.date) &&
			Number.isFinite(Date.parse(game.date)),
	);

const isHeadshotEntry = (entry: unknown) =>
	isRecord(entry) &&
	isNonEmptyString(entry.espnId) &&
	isString(entry.team) &&
	typeof entry.hasHeadshot === "boolean" &&
	isNullable(isString)(entry.image) &&
	isNullable(isNumber)(entry.imageAt) &&
	isNullable(isNumber)(entry.attemptAt) &&
	isNullable(isString)(entry.etag);

const isHeadshotsFile = (value: Record<string, unknown>) =>
	isString(value.rostersAttemptedAt) &&
	isNullable(isString)(value.rostersAt) &&
	isRecord(value.players) &&
	Object.values(value.players).every(isHeadshotEntry) &&
	Array.isArray(value.unmatched) &&
	value.unmatched.every(isString);

const putLiveJson = (key: string, value: unknown) =>
	s3Client.send(
		new PutObjectCommand({
			Bucket: assetsBucket,
			Key: key,
			Body: JSON.stringify(value),
			ContentType: "application/json",
			CacheControl: LIVE_JSON_CACHE_CONTROL,
		}),
	);

const loadPlayers = async (): Promise<PoolPlayer[]> => {
	const { Body } = await s3Client.send(
		new GetObjectCommand({ Bucket: staticDataBucket, Key: "players.json" }),
	);
	const { data } = JSON.parse(await Body!.transformToString()) as { data?: unknown };
	if (!Array.isArray(data)) throw new Error("players.json has no data array");
	return data as PoolPlayer[];
};

// ---- Headshot join ----

const label = (athlete: RosterAthlete) => `${athlete.name} (${athlete.espnId})`;

/**
 * Joins ESPN athletes to BBRef ids with the ratings matcher, keeping the image
 * state of every player whose ESPN id hasn't changed. Anything doubtful is
 * left unmatched: a missing headshot shows initials, a wrong one shows
 * someone else's face.
 */
export const buildHeadshotMap = (
	athletes: RosterAthlete[],
	pool: PoolPlayer[],
	prev: Record<string, HeadshotEntry>,
): { players: Record<string, HeadshotEntry>; unmatched: string[] } => {
	// The same athlete on two rosters (mid-trade) is one athlete, not a
	// conflict.
	const unique = new Map<string, RosterAthlete>();
	for (const athlete of athletes) {
		if (!unique.has(athlete.espnId)) unique.set(athlete.espnId, athlete);
	}

	const byName = indexByName(pool);
	const claims = new Map<string, RosterAthlete[]>();
	const unmatched: string[] = [];
	for (const athlete of unique.values()) {
		let match = resolveMatch(byName.get(normalizeName(athlete.name)) ?? [], {
			name: athlete.name,
			heightInches: athlete.heightInches,
			currentOnly: true,
		});
		// A rookie BBRef hasn't indexed yet can share a name with a retired
		// player, who is then the only candidate. BBRef's `active` flag lags
		// for real players too, so a height match is what confirms them.
		if (match && !match.active) {
			const inches = toTotalInches(match.height_feet, match.height_inches);
			if (
				athlete.heightInches === null ||
				inches === null ||
				Math.abs(inches - athlete.heightInches) > 1
			) {
				match = null;
			}
		}
		if (!match) {
			unmatched.push(label(athlete));
			continue;
		}
		const claim = claims.get(match.id);
		if (claim) claim.push(athlete);
		else claims.set(match.id, [athlete]);
	}

	const players: Record<string, HeadshotEntry> = {};
	for (const [id, claim] of claims) {
		if (claim.length > 1) {
			unmatched.push(...claim.map(label));
			continue;
		}
		const [athlete] = claim;
		const before = prev[id]?.espnId === athlete.espnId ? prev[id] : null;
		players[id] = {
			espnId: athlete.espnId,
			team: athlete.team,
			hasHeadshot: athlete.hasHeadshot,
			image: before?.image ?? null,
			imageAt: before?.imageAt ?? null,
			attemptAt: before?.attemptAt ?? null,
			etag: before?.etag ?? null,
		};
	}
	return { players, unmatched: unmatched.sort() };
};

const teamsOf = (standings: StandingsFile | null): { espnId: string; abbreviation: string }[] =>
	standings ? standings.conferences.flatMap((c) => c.teams) : [];

// ---- Handler ----

interface Summary {
	standings: string;
	schedule: string;
	rosters: string;
	headshots: { mirrored: number; unchanged: number; failed: number };
}

export const handler: Handler = async (event, context) => {
	console.log(JSON.stringify({ event }));

	// Per invocation, so a warm Lambda (or the next test) starts unpaced.
	let lastStart = 0;
	const espnFetch = async (url: string, headers: Record<string, string> = {}) => {
		const wait = lastStart + ESPN_REQUEST_INTERVAL_MS - Date.now();
		if (wait > 0) await sleep(wait);
		lastStart = Date.now();
		// No status check here: a 304 has `ok === false`. A caller that
		// doesn't read the body releases it with `release`.
		return fetch(url, {
			headers: { "User-Agent": ESPN_USER_AGENT, ...headers },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
	};
	const espnJson = async (url: string): Promise<unknown> => {
		const res = await espnFetch(url, { Accept: "application/json" });
		if (!res.ok) {
			await release(res);
			throw new Error(`ESPN ${res.status} for ${url}`);
		}
		return res.json();
	};

	const summary: Summary = {
		standings: "",
		schedule: "",
		rosters: "",
		headshots: { mirrored: 0, unchanged: 0, failed: 0 },
	};
	const kept = (dataset: "standings" | "schedule" | "rosters", reason: string) => {
		summary[dataset] = `kept: ${reason}`;
		console.error(`Kept the previous ${dataset}: ${reason}`);
	};

	const [prevStandings, prevSchedule, prevHeadshots] = await Promise.all([
		readLiveJson<StandingsFile>(STANDINGS_KEY, isStandingsFile),
		readLiveJson<ScheduleFile>(SCHEDULE_KEY, isScheduleFile),
		readLiveJson<HeadshotsFile>(HEADSHOTS_KEY, isHeadshotsFile),
	]);

	// Standings
	let standings: StandingsFile | null = null;
	try {
		const parsed = parseStandings(
			await espnJson(ESPN_STANDINGS_URL),
			new Date().toISOString(),
		);
		if (parsed.ok) {
			await putLiveJson(STANDINGS_KEY, parsed.value);
			standings = parsed.value;
			summary.standings = "saved";
		} else {
			kept("standings", parsed.error);
		}
	} catch (err) {
		kept("standings", message(err));
	}

	// Schedule: one request per day, since ESPN refuses date ranges. One bad
	// day keeps the whole previous file. So does a previous file S3 failed to
	// return, since the shrink guard needs it; a corrupt one is replaced.
	if (prevSchedule.state === "unreadable" && prevSchedule.cause === "read") {
		kept("schedule", "unreadable previous file");
	} else {
		try {
			const dates = scheduleDates(new Date());
			const games = new Map<string, ScheduleGame>();
			for (const date of dates) {
				const parsed = parseScoreboardDay(
					await espnJson(`${ESPN_API_BASE_URL}/scoreboard?dates=${date}`),
				);
				if (!parsed.ok) throw new Error(`${date}: ${parsed.error}`);
				for (const game of parsed.value) games.set(game.id, game);
			}
			const next: ScheduleFile = {
				version: 1,
				generatedAt: new Date().toISOString(),
				dates,
				games: [...games.values()].sort(
					(a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id),
				),
			};
			const shrink = scheduleShrinkReason(
				prevSchedule.state === "ok" ? prevSchedule.value : null,
				next,
			);
			if (shrink) {
				kept("schedule", shrink);
			} else {
				await putLiveJson(SCHEDULE_KEY, next);
				summary.schedule = "saved";
			}
		} catch (err) {
			kept("schedule", message(err));
		}
	}

	// Headshots. A previous file S3 failed to return skips this run: a
	// rebuild without it would forget every mirrored image. A corrupt one is
	// rebuilt like a first run; the images are still in S3, so that costs
	// re-downloads (100 a run), not a stall until someone deletes the file.
	if (prevHeadshots.state === "unreadable" && prevHeadshots.cause === "read") {
		kept("rosters", "unreadable previous file");
		console.log(JSON.stringify(summary));
		return { statusCode: 200, body: JSON.stringify(summary) };
	}

	let file: HeadshotsFile | null =
		prevHeadshots.state === "ok" ? structuredClone(prevHeadshots.value) : null;
	let changed = false;

	const attemptedS = file ? Date.parse(file.rostersAttemptedAt) / 1000 : NaN;
	const rostersDue =
		!file || !(Date.now() / 1000 - attemptedS < ROSTERS_EVERY_SECONDS);
	let teams = rostersDue ? teamsOf(standings) : [];
	if (rostersDue && !teams.length && prevStandings.state === "ok") {
		teams = teamsOf(prevStandings.value);
	}
	if (rostersDue && !teams.length) {
		// Standings are missing, not the rosters, so this isn't charged as a
		// rebuild attempt: the next run tries again.
		kept("rosters", "no team ids");
	} else if (rostersDue) {
		const now = new Date().toISOString();
		try {
			const athletes: RosterAthlete[] = [];
			for (const team of teams) {
				const parsed = parseRoster(
					await espnJson(`${ESPN_API_BASE_URL}/teams/${team.espnId}/roster`),
					team.abbreviation,
				);
				if (!parsed.ok) throw new Error(parsed.error);
				athletes.push(...parsed.value);
			}

			const built = buildHeadshotMap(athletes, await loadPlayers(), file?.players ?? {});
			const shrink = headshotsShrinkReason(
				file ? Object.keys(file.players).length : null,
				Object.keys(built.players).length,
			);
			if (shrink) throw new Error(shrink);

			file = {
				version: 1,
				generatedAt: now,
				rostersAt: now,
				rostersAttemptedAt: now,
				players: built.players,
				unmatched: built.unmatched,
			};
			summary.rosters = "saved";
			if (built.unmatched.length) {
				console.warn(`Unmatched ESPN athletes: ${built.unmatched.join(", ")}`);
			}
		} catch (err) {
			kept("rosters", message(err));
			// The attempt still counts, so a broken source costs one rebuild
			// a day. With no previous file, an empty one carries the stamp.
			file ??= {
				version: 1,
				generatedAt: now,
				rostersAt: null,
				rostersAttemptedAt: now,
				players: {},
				unmatched: [],
			};
			file.rostersAttemptedAt = now;
		}
		changed = true;
	} else {
		summary.rosters = "not due";
	}

	if (file) {
		const picks = pickHeadshotsToMirror(
			file.players,
			Math.floor(Date.now() / 1000),
			HEADSHOT_BATCH,
		);
		for (const id of picks) {
			if (context.getRemainingTimeInMillis() < STOP_WITH_REMAINING_MS) break;
			const entry = file.players[id];
			const revalidate = entry.image !== null && entry.etag !== null;
			let outcome: "mirrored" | "unchanged" | "failed" = "failed";
			let res: Response | undefined;
			try {
				res = await espnFetch(
					`${ESPN_HEADSHOT_BASE_URL}/${entry.espnId}.png`,
					revalidate ? { "If-None-Match": entry.etag! } : {},
				);
				const atS = Math.floor(Date.now() / 1000);
				entry.attemptAt = atS;
				if (res.status === 304 && revalidate) {
					entry.imageAt = atS;
					outcome = "unchanged";
				} else if (
					res.status === 200 &&
					res.headers.get("content-type")?.startsWith("image/png")
				) {
					const image = Buffer.from(await res.arrayBuffer());
					if (image.length >= MIN_IMAGE_BYTES && image.length <= MAX_IMAGE_BYTES) {
						await s3Client.send(
							new PutObjectCommand({
								Bucket: assetsBucket,
								Key: headshotKey(entry.espnId),
								Body: image,
								ContentType: "image/png",
								CacheControl: HEADSHOT_CACHE_CONTROL,
							}),
						);
						entry.image = headshotPath(entry.espnId);
						entry.imageAt = atS;
						entry.etag = res.headers.get("etag");
						outcome = "mirrored";
					}
				}
			} catch (err) {
				entry.attemptAt = Math.floor(Date.now() / 1000);
				console.error(`Headshot ${entry.espnId} failed`, err);
			} finally {
				if (res) await release(res);
			}
			summary.headshots[outcome]++;
			changed = true;
		}

		if (changed) {
			await putLiveJson(HEADSHOTS_KEY, { ...file, generatedAt: new Date().toISOString() });
		}
	}

	console.log(JSON.stringify(summary));
	return { statusCode: 200, body: JSON.stringify(summary) };
};
