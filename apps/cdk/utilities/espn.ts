import { isRecord } from "utilities/type-guards";
import type {
	ConferenceName,
	GameStatus,
	HeadshotEntry,
	InjuryEntry,
	InjuryKind,
	InjuryReport,
	Parsed,
	RosterAthlete,
	ScheduleFile,
	ScheduleGame,
	ScheduleTeam,
	StandingsFile,
	StandingsTeam,
} from "models/live-data";

// Parsers and guards for setSeasonContextData. ESPN's endpoints are
// unofficial and change without notice, so every response is validated here
// and a failure keeps the previous file rather than writing a broken one.

export const TEAMS_PER_CONFERENCE = 15;
export const CONFERENCES: ConferenceName[] = ["East", "West"];

// A rebuild that matches fewer athletes than this is a broken roster or
// players.json, not a real league (about 500 match in season).
export const MIN_MATCHED_ATHLETES = 300;
const MIN_MATCHED_SHARE = 0.8;

// A schedule window that loses over half the games it already held for the
// same days is a bad response, not a real change.
const MIN_PRIOR_GAMES_FOR_SHRINK_GUARD = 10;

// A failed image fetch waits a day; a mirrored one is revalidated monthly.
export const HEADSHOT_RETRY_SECONDS = 86_400;
export const HEADSHOT_REFRESH_SECONDS = 30 * 86_400;

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(error: string): Parsed<T> => ({ ok: false, error });

export const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

// ---- Standings ----

const statsByType = (stats: unknown): Map<string, Record<string, unknown>> => {
	const byType = new Map<string, Record<string, unknown>>();
	if (!Array.isArray(stats)) return byType;
	for (const stat of stats) {
		if (isRecord(stat) && typeof stat.type === "string") byType.set(stat.type, stat);
	}
	return byType;
};

const parseStandingsTeam = (entry: unknown): StandingsTeam | string => {
	if (!isRecord(entry) || !isRecord(entry.team)) return "entry without a team";
	const { id, displayName, abbreviation } = entry.team;
	if (!isNonEmptyString(id) || !isNonEmptyString(displayName) || !isNonEmptyString(abbreviation)) {
		return "team without an id, name or abbreviation";
	}
	const stats = statsByType(entry.stats);
	const number = (type: string): number | null => {
		const value = stats.get(type)?.value;
		return typeof value === "number" && Number.isFinite(value) ? value : null;
	};
	const display = (type: string): string => {
		const value = stats.get(type)?.displayValue;
		return typeof value === "string" ? value : "";
	};

	const wins = number("wins");
	const losses = number("losses");
	const winPercent = number("winpercent");
	const seed = number("playoffseed");
	if (wins === null || losses === null || winPercent === null || seed === null) {
		return `${abbreviation} without wins, losses, win percent or seed`;
	}
	// The leader's games behind is "-", which ESPN also sends as value 0.
	const gamesBehind = number("gamesbehind") ?? (display("gamesbehind") === "-" ? 0 : null);
	if (gamesBehind === null) return `${abbreviation} without games behind`;

	return {
		espnId: id,
		name: displayName,
		abbreviation,
		seed,
		wins,
		losses,
		winPercent,
		gamesBehind,
		streak: display("streak"),
		lastTen: display("lasttengames"),
		home: display("home"),
		road: display("road"),
	};
};

// Seeds can tie early in the season, so they're sorted, not required to be
// unique.
const bySeed = (a: StandingsTeam, b: StandingsTeam): number =>
	a.seed - b.seed || b.winPercent - a.winPercent || a.name.localeCompare(b.name);

export const parseStandings = (body: unknown, generatedAt: string): Parsed<StandingsFile> => {
	if (!isRecord(body) || !Array.isArray(body.children)) return fail("no conferences");
	if (body.children.length !== CONFERENCES.length) {
		return fail(`${body.children.length} conferences, expected ${CONFERENCES.length}`);
	}
	const season = isRecord(body.season) ? body.season : {};
	if (typeof season.year !== "number" || !isNonEmptyString(season.displayName)) {
		return fail("no season");
	}

	const conferences: StandingsFile["conferences"] = [];
	for (const name of CONFERENCES) {
		// Matched on the abbreviation: `name` is "Eastern Conference".
		const child = body.children.find((c) => isRecord(c) && c.abbreviation === name);
		const entries = isRecord(child) && isRecord(child.standings) ? child.standings.entries : null;
		if (!Array.isArray(entries)) return fail(`no ${name} conference`);
		if (entries.length !== TEAMS_PER_CONFERENCE) {
			return fail(`${name} has ${entries.length} teams, expected ${TEAMS_PER_CONFERENCE}`);
		}
		const teams: StandingsTeam[] = [];
		for (const entry of entries) {
			const team = parseStandingsTeam(entry);
			if (typeof team === "string") return fail(`${name}: ${team}`);
			teams.push(team);
		}
		conferences.push({ name, teams: teams.sort(bySeed) });
	}

	return ok({
		version: 1,
		generatedAt,
		season: { year: season.year, displayName: season.displayName },
		conferences,
	});
};

// ---- Schedule ----

const toStatus = (type: Record<string, unknown>): GameStatus | null => {
	if (typeof type.name === "string" && /POSTPONED|CANCELED|SUSPENDED/.test(type.name)) {
		return "postponed";
	}
	if (type.state === "pre") return "scheduled";
	if (type.state === "in") return "live";
	if (type.state === "post") return "final";
	return null;
};

const parseCompetitor = (
	competitor: Record<string, unknown>,
	status: GameStatus,
): ScheduleTeam | null => {
	if (!isRecord(competitor.team)) return null;
	const { id, abbreviation } = competitor.team;
	if (!isNonEmptyString(id) || !isNonEmptyString(abbreviation)) return null;
	// ESPN sends "0" before tip-off and for a postponed game.
	if (status === "scheduled" || status === "postponed") {
		return { espnId: id, abbreviation, score: null };
	}
	const score = Number(competitor.score);
	if (competitor.score === undefined || !Number.isFinite(score)) return null;
	return { espnId: id, abbreviation, score };
};

export const parseScoreboardDay = (body: unknown): Parsed<ScheduleGame[]> => {
	if (!isRecord(body) || !Array.isArray(body.events)) return fail("no events");
	const games: ScheduleGame[] = [];
	for (const event of body.events) {
		if (!isRecord(event) || !isNonEmptyString(event.id)) return fail("event without an id");
		const { id, date } = event;
		// Kept as sent: ESPN's dates have no seconds ("2026-10-26T23:00Z").
		if (typeof date !== "string" || !Number.isFinite(Date.parse(date))) {
			return fail(`event ${id} without a date`);
		}
		const competition = Array.isArray(event.competitions) ? event.competitions[0] : null;
		if (!isRecord(competition)) return fail(`event ${id} without a competition`);
		const type = isRecord(competition.status) && isRecord(competition.status.type)
			? competition.status.type
			: null;
		const status = type && toStatus(type);
		if (!status) return fail(`event ${id} without a status`);

		const competitors = Array.isArray(competition.competitors)
			? competition.competitors.filter(isRecord)
			: [];
		const side = (homeAway: string) => {
			const found = competitors.filter((c) => c.homeAway === homeAway);
			return found.length === 1 ? parseCompetitor(found[0], status) : null;
		};
		const home = side("home");
		const away = side("away");
		if (!home || !away) return fail(`event ${id} without one home and one away team`);

		games.push({ id, date, status, home, away });
	}
	return ok(games);
};

const ET_DATE = new Intl.DateTimeFormat("en-CA", {
	timeZone: "America/New_York",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

// YYYYMMDD of the New York calendar day an instant falls on.
export const etDate = (instant: Date | number): string => ET_DATE.format(instant).replace(/-/g, "");

/**
 * The ET calendar days the schedule covers, `back` days before today through
 * `ahead` days after. Stepped by calendar day from today's ET date, so a DST
 * change can't skip or repeat a day the way adding 24h can.
 */
export const scheduleDates = (now: Date, back = 1, ahead = 6): string[] => {
	const today = etDate(now);
	const [y, m, d] = [today.slice(0, 4), today.slice(4, 6), today.slice(6, 8)].map(Number);
	const dates: string[] = [];
	for (let i = -back; i <= ahead; i++) {
		dates.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10).replace(/-/g, ""));
	}
	return dates;
};

export const scheduleShrinkReason = (
	prev: ScheduleFile | null,
	next: ScheduleFile,
): string | null => {
	if (!prev) return null;
	const days = new Set(next.dates);
	const prior = prev.games.filter((g) => days.has(etDate(Date.parse(g.date)))).length;
	if (prior >= MIN_PRIOR_GAMES_FOR_SHRINK_GUARD && next.games.length < prior / 2) {
		return `${next.games.length} games for days that held ${prior}`;
	}
	return null;
};

// ---- Rosters and headshots ----

export const parseRoster = (body: unknown, team: string): Parsed<RosterAthlete[]> => {
	if (!isRecord(body) || !Array.isArray(body.athletes) || body.athletes.length === 0) {
		return fail(`${team}: no athletes`);
	}
	const athletes: RosterAthlete[] = [];
	for (const athlete of body.athletes) {
		if (!isRecord(athlete) || !isNonEmptyString(athlete.id) || !isNonEmptyString(athlete.fullName)) {
			return fail(`${team}: athlete without an id or name`);
		}
		const { height, headshot } = athlete;
		athletes.push({
			espnId: athlete.id,
			name: athlete.fullName,
			heightInches: typeof height === "number" && Number.isFinite(height) ? height : null,
			team,
			hasHeadshot: isRecord(headshot) && typeof headshot.href === "string",
		});
	}
	return ok(athletes);
};

export const headshotsShrinkReason = (
	prevMatched: number | null,
	nextMatched: number,
): string | null => {
	if (nextMatched < MIN_MATCHED_ATHLETES) {
		return `${nextMatched} matched athletes, under ${MIN_MATCHED_ATHLETES}`;
	}
	if (prevMatched !== null && nextMatched < prevMatched * MIN_MATCHED_SHARE) {
		return `${nextMatched} matched athletes, down from ${prevMatched}`;
	}
	return null;
};

/**
 * BBRef ids whose headshot to fetch this run: never-mirrored images first (by
 * id), then mirrored ones due for revalidation (oldest first), up to `batch`.
 * Any attempt in the last day holds an entry back, so a 404 or an outage
 * costs one request a day, not one an hour.
 */
export const pickHeadshotsToMirror = (
	players: Record<string, HeadshotEntry>,
	nowS: number,
	batch: number,
): string[] => {
	const missing: string[] = [];
	const stale: [string, number][] = [];
	for (const [id, entry] of Object.entries(players)) {
		if (!entry.hasHeadshot) continue;
		if (entry.attemptAt !== null && nowS - entry.attemptAt < HEADSHOT_RETRY_SECONDS) continue;
		if (entry.image === null || entry.imageAt === null) missing.push(id);
		else if (nowS - entry.imageAt >= HEADSHOT_REFRESH_SECONDS) stale.push([id, entry.imageAt]);
	}
	missing.sort();
	stale.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
	return [...missing, ...stale.map(([id]) => id)].slice(0, batch);
};

// ---- Injuries ----

// Under half of this many injured athletes joining a BBRef id means the
// headshots map or ESPN's ids broke, not a real report.
export const MIN_INJURIES_FOR_JOIN_GUARD = 10;
const MIN_JOINED_SHARE = 0.5;

// Player pages only (/player/_/id/N, /player/stats/_/id/N, ...): a team or
// game link elsewhere in `links` would read as a second, conflicting id.
const ID_PATTERNS = [/\/player\/(?:[a-z-]+\/)?_\/id\/(\d+)(?:\/|$)/, /~a:(\d+)/, /\/players\/full\/(\d+)\.png/];

/**
 * The injuries report has no athlete id field: the id only appears in the
 * athlete's links and headshot URL. Exactly one distinct id, or null.
 */
export const espnAthleteId = (athlete: unknown): string | null => {
	if (!isRecord(athlete)) return null;
	const ids = new Set<string>();
	if (typeof athlete.id === "string" && /^\d+$/.test(athlete.id)) ids.add(athlete.id);
	const hrefs: unknown[] = Array.isArray(athlete.links)
		? athlete.links.map((link) => (isRecord(link) ? link.href : null))
		: [];
	if (isRecord(athlete.headshot)) hrefs.push(athlete.headshot.href);
	for (const href of hrefs) {
		if (typeof href !== "string") continue;
		for (const pattern of ID_PATTERNS) {
			const match = pattern.exec(href);
			if (match) ids.add(match[1]);
		}
	}
	return ids.size === 1 ? [...ids][0] : null;
};

const injuryKind = (type: unknown, status: string): InjuryKind => {
	const name = isRecord(type) ? type.name : null;
	if (name === "INJURY_STATUS_OUT") return "out";
	if (name === "INJURY_STATUS_DAYTODAY") return "day-to-day";
	const label = status.toLowerCase();
	if (label === "out") return "out";
	if (label === "day-to-day") return "day-to-day";
	return "other";
};

const parseInjuryEntry = (entry: unknown): InjuryReport | null => {
	if (!isRecord(entry) || !isNonEmptyString(entry.status) || !isRecord(entry.athlete)) return null;
	const espnId = espnAthleteId(entry.athlete);
	if (espnId === null) return null;
	return {
		espnId,
		name: isNonEmptyString(entry.athlete.displayName) ? entry.athlete.displayName : "",
		status: entry.status,
		kind: injuryKind(entry.type, entry.status),
		comment: typeof entry.shortComment === "string" ? entry.shortComment : "",
		date: typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) ? entry.date : null,
	};
};

const laterReport = (a: InjuryReport, b: InjuryReport): InjuryReport => {
	if (a.date === null) return b;
	if (b.date === null) return a;
	return Date.parse(b.date) > Date.parse(a.date) ? b : a;
};

export const parseInjuries = (body: unknown): Parsed<{ reports: InjuryReport[]; skipped: number }> => {
	if (!isRecord(body) || !Array.isArray(body.injuries)) return fail("no injuries");
	const byId = new Map<string, InjuryReport>();
	let total = 0;
	let skipped = 0;
	for (const team of body.injuries) {
		if (!isRecord(team) || !Array.isArray(team.injuries)) return fail("team without injuries");
		for (const entry of team.injuries) {
			total++;
			const report = parseInjuryEntry(entry);
			if (report === null) {
				skipped++;
				continue;
			}
			const prev = byId.get(report.espnId);
			byId.set(report.espnId, prev ? laterReport(prev, report) : report);
		}
	}
	// ESPN lists long-term injuries for months, so an empty league is a broken
	// response, not a healthy one.
	if (total === 0) return fail("no injured athletes");
	if (skipped * 2 > total) return fail(`${skipped} of ${total} entries unreadable`);
	return ok({ reports: [...byId.values()], skipped });
};

export const joinInjuries = (
	reports: InjuryReport[],
	headshots: Record<string, HeadshotEntry>,
): { players: Record<string, InjuryEntry>; unmatched: string[] } => {
	const bbrefByEspn = new Map(Object.entries(headshots).map(([bbrefId, entry]) => [entry.espnId, bbrefId]));
	const players: Record<string, InjuryEntry> = {};
	const unmatched: string[] = [];
	for (const { espnId, name, status, kind, comment, date } of reports) {
		const bbrefId = bbrefByEspn.get(espnId);
		if (bbrefId) players[bbrefId] = { espnId, status, kind, comment, date };
		else unmatched.push(`${name} (${espnId})`);
	}
	unmatched.sort();
	return { players, unmatched };
};

export const injuriesJoinReason = (total: number, joined: number): string | null =>
	total >= MIN_INJURIES_FOR_JOIN_GUARD && joined < total * MIN_JOINED_SHARE
		? `${joined} of ${total} injured athletes joined`
		: null;
