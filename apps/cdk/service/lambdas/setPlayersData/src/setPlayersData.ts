import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import type { HeadshotsFile } from "models/live-data";
import type { TeamSeasonsIndex } from "models/team-seasons";
import {
	CURRENT_TEAM_SEASON_KEY,
	HEADSHOTS_KEY,
	LIVE_JSON_CACHE_CONTROL,
	TEAM_SEASONS_INDEX_KEY,
} from "utilities/live-data";
import { currentSeasonEndYear } from "utilities/season";
import {
	buildTeamSeasonFile,
	parseCoaches,
	parseLeagueTeams,
	parsePerGame,
	seasonPaths,
	type RosterMember,
} from "utilities/team-seasons";

const { BBREF_BASE_URL = "", staticDataBucket = "", assetsBucket = "" } = process.env;

const s3Client = new S3Client();

// BBRef allows ~20 req/min; pace the 26 index pages well under that.
const REQUEST_DELAY_MS = 2800;
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

// The draft page runs after ~80s of letters in a 300s Lambda with no retries,
// so a stalled supplement must not cost the week's write.
const DRAFT_FETCH_TIMEOUT_MS = 20_000;

const PLAYERS_KEY = "players.json";
// A BBRef block silently drops whole letters, so a scrape that shrinks the
// list by more than this is treated as damaged rather than as a real change.
const MIN_RETAINED_FRACTION = 0.95;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// BBRef bumps a player's year_max only after their first game of the season,
// and opening night falls in mid-to-late October. Rolling over on Nov 1 rather
// than the Oct 1 season rollover keeps last season's players active through
// the preseason and the first week or so of games.
const ACTIVE_ROLLOVER_MONTH = 10; // November, 0-based like Date#getMonth

export const activeSeasonEndYear = (now: Date = new Date()): number =>
	now.getMonth() >= ACTIVE_ROLLOVER_MONTH
		? now.getFullYear() + 1
		: now.getFullYear();

// The draft is in late June, so before July the latest class is last year's.
const DRAFT_ROLLOVER_MONTH = 6; // July, 0-based like Date#getMonth

export const latestDraftYear = (now: Date = new Date()): number =>
	now.getMonth() >= DRAFT_ROLLOVER_MONTH
		? now.getFullYear()
		: now.getFullYear() - 1;

interface NormalizedPlayer {
	id: string;
	first_name: string;
	last_name: string;
	position: string;
	team: { full_name: string; abbreviation: string };
	height_feet: number | null;
	height_inches: number | null;
	weight_pounds: number | null;
	active: boolean;
}

// "6-9" -> { feet: 6, inches: 9 }
const parseHeight = (h: string): [number | null, number | null] => {
	const [f, i] = (h || "").split("-");
	const feet = parseInt(f, 10);
	const inches = parseInt(i, 10);
	return [
		Number.isFinite(feet) ? feet : null,
		Number.isFinite(inches) ? inches : null,
	];
};

const splitName = (fullName: string): [string, string] => {
	const spaceIdx = fullName.indexOf(" ");
	return spaceIdx === -1
		? [fullName, ""]
		: [fullName.slice(0, spaceIdx), fullName.slice(spaceIdx + 1)];
};

export const parsePage = (html: string, seasonEndYear: number): NormalizedPlayer[] => {
	const $ = cheerio.load(html);
	const players: NormalizedPlayer[] = [];

	$("table#players tbody tr").each((_, tr) => {
		const $tr = $(tr);
		const $th = $tr.find('th[data-stat="player"]');
		const id = $th.attr("data-append-csv");
		if (!id) return; // skip class="thead" separator rows

		const fullName = ($th.find("a").text() || $th.text()).trim();
		const [first_name, last_name] = splitName(fullName);

		const td = (stat: string) =>
			$tr.find(`td[data-stat="${stat}"]`).text().trim();

		const [height_feet, height_inches] = parseHeight(td("height"));
		const weight = parseInt(td("weight"), 10);
		const yearMax = parseInt(td("year_max"), 10);

		players.push({
			id,
			first_name,
			last_name,
			position: td("pos"),
			team: { full_name: "", abbreviation: "" },
			height_feet,
			height_inches,
			weight_pounds: Number.isFinite(weight) ? weight : null,
			active: Number.isFinite(yearMax) ? yearMax >= seasonEndYear : false,
		});
	});

	return players;
};

// A block or captcha page can come back as a 200 with no table at all, while
// /players/x/ legitimately has a table with no rows.
export const hasPlayersTable = (html: string): boolean =>
	cheerio.load(html)("table#players").length > 0;

const PLAYER_HREF = /^\/players\/[a-z]\/([a-z0-9]+)\.html$/;

// The draft page links each pick to the same id the /players/ index uses once
// the player has played, but carries no position, height or weight. Those
// fill in the week the index lists them.
export const parseDraftPage = (html: string): NormalizedPlayer[] => {
	const $ = cheerio.load(html);
	const players: NormalizedPlayer[] = [];

	$("table#stats tbody tr").each((_, tr) => {
		const $a = $(tr).find('td[data-stat="player"] a');
		const id = $a.attr("href")?.match(PLAYER_HREF)?.[1];
		if (!id) return; // separator rows, or a pick with no player page

		const [first_name, last_name] = splitName($a.text().trim());
		players.push({
			id,
			first_name,
			last_name,
			position: "",
			team: { full_name: "", abbreviation: "" },
			height_feet: null,
			height_inches: null,
			weight_pounds: null,
			active: true,
		});
	});

	return players;
};

export const hasDraftTable = (html: string): boolean =>
	cheerio.load(html)("table#stats").length > 0;

// headshots.json keeps ESPN's team abbreviations; the season pages use
// Basketball-Reference's. These nine are the ones that differ.
export const ESPN_TO_BBREF: Record<string, string> = {
	BKN: "BRK",
	CHA: "CHO",
	GS: "GSW",
	NO: "NOP",
	NY: "NYK",
	PHX: "PHO",
	SA: "SAS",
	UTAH: "UTA",
	WSH: "WAS",
};

// Before opening night, and for its first days, the season's per-game page
// has few rows or none; a file built from it would rank rosters on nothing.
export const MIN_CURRENT_SEASON_ROWS = 150;
// setSeasonContextData rebuilds rosters daily; a week without a rebuild means
// it is broken, and last week's file is better than rosters that old.
export const MAX_ROSTERS_AGE_MS = 8 * 24 * 60 * 60 * 1000;

const readS3Json = async <T>(bucket: string, key: string): Promise<T | null> => {
	try {
		const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
		return JSON.parse(await res.Body!.transformToString()) as T;
	} catch (err) {
		console.error(`Failed to read ${bucket}/${key}`, err);
		return null;
	}
};

const fetchSeasonPage = async (path: string): Promise<string> => {
	const res = await fetch(`${BBREF_BASE_URL}${path}`, {
		headers: { "User-Agent": "Mozilla/5.0 (compatible; TeamBuilder/1.0)" },
		signal: AbortSignal.timeout(DRAFT_FETCH_TIMEOUT_MS),
	});
	if (!res.ok) throw new Error(`${path} responded ${res.status}`);
	return res.text();
};

// The current roster of each team, by BBRef code, from the ESPN rosters
// setSeasonContextData joins daily. Players it couldn't match are already
// missing from it.
export const rosterMembers = (
	headshots: HeadshotsFile,
	ratings: Record<string, { rating?: number }>,
): Map<string, RosterMember[]> => {
	const members = new Map<string, RosterMember[]>();
	for (const [id, entry] of Object.entries(headshots.players)) {
		const code = ESPN_TO_BBREF[entry.team] ?? entry.team;
		members.set(code, [...(members.get(code) ?? []), { id, rating: ratings[id]?.rating ?? null }]);
	}
	return members;
};

/**
 * Writes the current season's team-season file (live/team-seasons/current.json
 * in the assets bucket), the one the refresh-team-seasons script leaves to
 * this Lambda. Rosters come from headshots.json; the season's per-game page
 * orders them and its coaches and league pages name the coach and arena.
 * Without fresh rosters it keeps the previous file: the per-game page alone
 * would keep traded-away players and miss signings who haven't played.
 * Returns what happened, for the run's log; never throws, so players.json is
 * never at stake.
 */
export const writeCurrentTeamSeason = async (
	positions: Map<string, string>,
	now: Date = new Date(),
): Promise<string> => {
	try {
		const year = currentSeasonEndYear(now);
		const paths = seasonPaths("NBA", year);
		const perGame = parsePerGame(await fetchSeasonPage(paths.perGame));
		if (perGame.length < MIN_CURRENT_SEASON_ROWS) {
			return `skipped: ${perGame.length} player rows for ${year} so far`;
		}
		await sleep(REQUEST_DELAY_MS);
		const coaches = parseCoaches(await fetchSeasonPage(paths.coaches), "NBA");
		await sleep(REQUEST_DELAY_MS);
		const teams = parseLeagueTeams(await fetchSeasonPage(paths.league));

		const [headshots, ratingsFile, index] = await Promise.all([
			readS3Json<HeadshotsFile>(assetsBucket, HEADSHOTS_KEY),
			readS3Json<{ data?: Record<string, { rating?: number }> }>(staticDataBucket, "player-ratings.json"),
			readS3Json<TeamSeasonsIndex>(assetsBucket, TEAM_SEASONS_INDEX_KEY),
		]);
		const rostersAt = headshots?.rostersAt ? Date.parse(headshots.rostersAt) : NaN;
		if (!headshots?.players || !Object.keys(headshots.players).length) {
			return "kept previous: no rosters in headshots.json";
		}
		if (!(now.getTime() - rostersAt < MAX_ROSTERS_AGE_MS)) {
			return `kept previous: headshots.json rosters are from ${headshots.rostersAt ?? "never"}`;
		}
		const members = rosterMembers(headshots, ratingsFile?.data ?? {});
		// Lineage codes from the finished seasons; a code new this season is
		// its own franchise until refresh-team-seasons publishes it.
		const lineage = new Map(index?.seasons.flatMap((s) => s.teams.map((t) => [t.code, t.franchise])) ?? []);

		const { file, problems } = buildTeamSeasonFile(
			{ league: "NBA", year, perGame, coaches, teams },
			(code) => lineage.get(code) ?? code,
			positions,
			now.toISOString(),
			members,
		);
		if (problems.length) return `kept previous: ${problems.join("; ")}`;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: assetsBucket,
				Key: CURRENT_TEAM_SEASON_KEY,
				Body: JSON.stringify(file),
				ContentType: "application/json",
				CacheControl: LIVE_JSON_CACHE_CONTROL,
			}),
		);
		return `saved ${year}: ${file.teams.length} teams`;
	} catch (err) {
		return `kept previous: ${err instanceof Error ? err.message : String(err)}`;
	}
};

export const refusalReason = (
	scrapedCount: number,
	currentCount: number | null,
): string | null => {
	if (currentCount !== null && scrapedCount < currentCount * MIN_RETAINED_FRACTION) {
		return `scraped ${scrapedCount} players, below 95% of the current ${currentCount}`;
	}
	if (scrapedCount === 0) return "scraped no players";
	return null;
};

// null means there is no players.json yet, so there is nothing to protect.
const loadCurrentCount = async (): Promise<number | null> => {
	try {
		const res = await s3Client.send(
			new GetObjectCommand({ Bucket: staticDataBucket, Key: PLAYERS_KEY }),
		);
		const parsed = JSON.parse(await res.Body!.transformToString());
		// Fail closed: counting a malformed file as empty would switch the
		// shrink guard off for exactly the file that most needs it.
		if (!Array.isArray(parsed?.data)) throw new Error(`${PLAYERS_KEY} has no data array`);
		return parsed.data.length;
	} catch (err) {
		if ((err as Error)?.name === "NoSuchKey") return null;
		throw err;
	}
};

const fetchLetter = async (
	letter: string,
	seasonEndYear: number,
): Promise<NormalizedPlayer[]> => {
	const res = await fetch(`${BBREF_BASE_URL}/players/${letter}/`, {
		headers: { "User-Agent": "Mozilla/5.0 (compatible; TeamBuilder/1.0)" },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const html = await res.text();
	if (!hasPlayersTable(html)) throw new Error("no players table on page");
	return parsePage(html, seasonEndYear);
};

const fetchDraftClass = async (year: number): Promise<NormalizedPlayer[]> => {
	const res = await fetch(`${BBREF_BASE_URL}/draft/NBA_${year}.html`, {
		headers: { "User-Agent": "Mozilla/5.0 (compatible; TeamBuilder/1.0)" },
		signal: AbortSignal.timeout(DRAFT_FETCH_TIMEOUT_MS),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const html = await res.text();
	if (!hasDraftTable(html)) throw new Error("no draft table on page");
	return parseDraftPage(html);
};

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context,
): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const currentCount = await loadCurrentCount();
	const seasonEndYear = activeSeasonEndYear();
	const byId = new Map<string, NormalizedPlayer>();

	for (const letter of LETTERS) {
		const found = await fetchLetter(letter, seasonEndYear).catch((e) => {
			console.error(`Failed letter ${letter}`, e);
			throw new Error(
				`Refusing to overwrite ${PLAYERS_KEY}: /players/${letter}/ failed (${e instanceof Error ? e.message : String(e)})`,
			);
		});
		for (const p of found) {
			byId.set(p.id, p);
		}
		await sleep(REQUEST_DELAY_MS);
	}

	const draftYear = latestDraftYear();
	// Draftees aren't in the index until they play. Same BBRef ids, so the
	// index row replaces this one the week it appears. A failure here only
	// costs the rookies, never the scrape.
	const draftees = await fetchDraftClass(draftYear).catch((e) => {
		console.error(`Skipping the ${draftYear} draft class`, e);
		return [] as NormalizedPlayer[];
	});
	let addedDraftees = 0;
	for (const p of draftees) {
		if (byId.has(p.id)) continue;
		byId.set(p.id, p);
		addedDraftees++;
	}

	const players = Array.from(byId.values()).sort((a, b) =>
		`${a.first_name} ${a.last_name}`.localeCompare(
			`${b.first_name} ${b.last_name}`,
		),
	);

	const reason = refusalReason(players.length, currentCount);
	if (reason) throw new Error(`Refusing to overwrite ${PLAYERS_KEY}: ${reason}`);

	await s3Client.send(
		new PutObjectCommand({
			Bucket: staticDataBucket,
			Key: PLAYERS_KEY,
			Body: JSON.stringify({ data: players }),
			ContentType: "application/json",
		}),
	);

	console.log(
		`Saved ${players.length} players to ${staticDataBucket}/${PLAYERS_KEY} (was ${currentCount ?? "none"}), incl. ${addedDraftees} from the ${draftYear} draft`,
	);

	await sleep(REQUEST_DELAY_MS);
	const currentTeamSeason = await writeCurrentTeamSeason(
		new Map(players.filter((p) => p.position).map((p) => [p.id, p.position])),
	);
	// A kept-previous outcome is a failure worth an error line, not just a log.
	(currentTeamSeason.startsWith("kept previous") ? console.error : console.log)(
		`Current team season: ${currentTeamSeason}`,
	);

	return {
		statusCode: 200,
		body: JSON.stringify({
			message: "Players saved",
			count: players.length,
			draftees: addedDraftees,
			currentTeamSeason,
		}),
	};
};
