/**
 * Puzzle-list logic for refresh-daily-era: which jerseys make the pool, how
 * look-alike jerseys share one answer, which groups are unsafe to publish,
 * and the opaque ids the published images live under.
 */
import { randomBytes } from "node:crypto";
import {
	DAILY_ERA_IMAGE_PREFIX,
	type DailyEraPuzzle,
	type JerseyIdentity,
} from "../../models/daily-era";
import { mulberry32 } from "../../utilities/seeded-random";
import { formatJerseyYears, type ParsedJersey } from "./historicalJerseys";

export type PoolRow = ParsedJersey & { jersey: string };

export interface PuzzleGroup {
	rows: PoolRow[];
	shown: PoolRow;
	answerSeasons: number[];
}

export const selectPoolRows = <T extends PoolRow>(rows: T[]) =>
	rows.filter((row) => row.slot === "home-road" && row.franchise);

/** A jersey still worn today: its answer set would keep growing. */
export const isPresentRow = (row: PoolRow) => /present/i.test(row.name);

/** The Wix media id stem of a jersey image URL (`31d308_…`), or null. */
export const mediaIdFromJerseyUrl = (url: string) => {
	const stem = url.split("/").pop()?.replace(/\.[^.]*$/, "") ?? "";
	return /^[A-Za-z0-9_]+$/.test(stem) ? stem : null;
};

export const jerseyIdentity = (row: PoolRow): JerseyIdentity => {
	const mediaId = mediaIdFromJerseyUrl(row.jersey);
	if (!mediaId) throw new Error(`${row.name}: no media id in ${row.jersey}`);
	return { franchise: row.franchise, name: row.name, startYear: row.startYear, mediaId };
};

export const findIdentityCollisions = (rows: PoolRow[]) => {
	const problems: string[] = [];
	const seen = new Map<string, PoolRow>();
	for (const row of rows) {
		const mediaId = mediaIdFromJerseyUrl(row.jersey);
		if (!mediaId) {
			problems.push(`${row.name}: no media id in ${row.jersey}`);
			continue;
		}
		const first = seen.get(mediaId);
		if (first) problems.push(`${row.name}: shares media id ${mediaId} with ${first.name}`);
		else seen.set(mediaId, row);
	}
	return problems;
};

export const seasonEndYearFromLabel = (label: string) => {
	const match = /^(\d{4})-\d{2}$/.exec(label);
	if (!match) throw new Error(`Unexpected season label "${label}"`);
	return Number(match[1]) + 1;
};

/** Season ending years the jersey was worn, ascending. */
export const answerSeasonsForRow = (row: PoolRow) => {
	const years =
		row.seasons.length > 0
			? row.seasons.map(seasonEndYearFromLabel)
			: Array.from({ length: row.endYear - row.startYear + 1 }, (_, i) => row.startYear + i);
	return [...new Set(years)].sort((a, b) => a - b);
};

/** "1995-96, 1997-98 – 1998-99": one range per contiguous run, never one span over a gap. */
export const formatRunLabel = (endYears: number[]) => {
	const runs: [number, number][] = [];
	for (const year of endYears) {
		const last = runs[runs.length - 1];
		if (last && year === last[1] + 1) last[1] = year;
		else runs.push([year, year]);
	}
	return runs.map(([start, end]) => formatJerseyYears(start, end)).join(", ");
};

/** The team's name in that era: "Vancouver Grizzlies" from "Vancouver Grizzlies 1995-2000 …". */
export const eraTeamName = (name: string) => /^(.*?) \d{4}/.exec(name)?.[1] ?? null;

/**
 * Groups jerseys `isTwin` calls the same, transitively (union-find), only ever
 * comparing jerseys of one franchise. Output is sorted so reruns match.
 */
export const groupTwins = <T>(
	candidates: { key: string; franchise: string; item: T }[],
	isTwin: (a: T, b: T) => boolean,
): string[][] => {
	const parent = new Map(candidates.map((c) => [c.key, c.key]));
	const find = (key: string): string => {
		const up = parent.get(key)!;
		if (up === key) return key;
		const root = find(up);
		parent.set(key, root);
		return root;
	};

	const byFranchise = new Map<string, typeof candidates>();
	for (const c of candidates) byFranchise.set(c.franchise, [...(byFranchise.get(c.franchise) ?? []), c]);
	for (const members of byFranchise.values()) {
		for (let i = 0; i < members.length; i++) {
			for (let j = i + 1; j < members.length; j++) {
				if (find(members[i].key) === find(members[j].key)) continue;
				if (isTwin(members[i].item, members[j].item)) parent.set(find(members[i].key), find(members[j].key));
			}
		}
	}

	const groups = new Map<string, string[]>();
	for (const c of candidates) {
		const root = find(c.key);
		groups.set(root, [...(groups.get(root) ?? []), c.key]);
	}
	return [...groups.values()]
		.map((keys) => keys.sort())
		.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
};

/** The puzzle shows the earliest jersey; a guess in any member's seasons is a hit. */
export const buildGroup = (rows: PoolRow[]): PuzzleGroup => {
	const shown = [...rows].sort(
		(a, b) =>
			a.startYear - b.startYear ||
			a.name.localeCompare(b.name) ||
			jerseyIdentity(a).mediaId.localeCompare(jerseyIdentity(b).mediaId),
	)[0];
	const answerSeasons = [...new Set(rows.flatMap(answerSeasonsForRow))].sort((a, b) => a - b);
	return { rows, shown, answerSeasons };
};

/**
 * Why a group can't be published, or null. Unsafe rows are Present jerseys
 * and jerseys the image step dropped: a player who knows one of them could be
 * marked wrong for a look-alike, so the group stays out when one of the same
 * franchise was worn within `window` seasons of its answers.
 */
export const exclusionReason = (group: PuzzleGroup, unsafeRows: PoolRow[], window = 3) => {
	const present = group.rows.find(isPresentRow);
	if (present) return `includes ${present.name}, still in use`;

	for (const unsafe of unsafeRows) {
		if (unsafe.franchise !== group.shown.franchise || group.rows.includes(unsafe)) continue;
		const near = answerSeasonsForRow(unsafe).some((season) =>
			group.answerSeasons.some((answer) => Math.abs(season - answer) <= window),
		);
		if (near) return `within ${window} seasons of ${unsafe.name}`;
	}
	return null;
};

export const seededShuffle = <T>(items: T[], seed: number) => {
	const random = mulberry32(seed);
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

export { parsePuzzleList } from "../../utilities/daily-era";

/**
 * Splits groups against the published list, matching by media id. A group
 * that is part-published (a new twin of a live puzzle) is reported rather
 * than appended: publishing it would show the same jersey twice.
 */
export const planAppend = (existing: DailyEraPuzzle[], groups: PuzzleGroup[]) => {
	const publishedIn = new Map<string, string>();
	for (const puzzle of existing) {
		for (const identity of puzzle.identities) publishedIn.set(identity.mediaId, puzzle.puzzleId);
	}

	const toAppend: PuzzleGroup[] = [];
	const twinsOfPublished: { identity: JerseyIdentity; puzzleId: string }[] = [];
	let alreadyPublished = 0;
	for (const group of groups) {
		const identities = group.rows.map(jerseyIdentity);
		const puzzleId = identities.map((i) => publishedIn.get(i.mediaId)).find(Boolean);
		if (!puzzleId) {
			toAppend.push(group);
			continue;
		}
		const unpublished = identities.filter((i) => !publishedIn.has(i.mediaId));
		if (unpublished.length === 0) alreadyPublished++;
		for (const identity of unpublished) twinsOfPublished.push({ identity, puzzleId });
	}
	return { toAppend, alreadyPublished, twinsOfPublished };
};

export type ByteSource = (n: number) => Buffer;

/**
 * Lowercased substrings an id must never contain: every current franchise
 * code, every era code passed in (historicalLogos.json's `team`, e.g. VAN,
 * which `franchise` - always the current code - never holds), and every era
 * nickname ("grizzlies").
 */
export const forbiddenIdTokens = (rows: PoolRow[], extraCodes: readonly string[] = []) => {
	const tokens = new Set<string>();
	for (const row of rows) {
		tokens.add(row.franchise.toLowerCase());
		const nickname = eraTeamName(row.name)?.split(/[ /]/).pop();
		if (nickname && nickname.length >= 3) tokens.add(nickname.toLowerCase());
	}
	for (const code of extraCodes) tokens.add(code.toLowerCase());
	return [...tokens];
};

/** False if `id` spells a year or contains a team token, in any case. */
export const isOpaqueId = (id: string, forbidden: readonly string[]) => {
	const lower = id.toLowerCase();
	return !/\d{4}/.test(id) && !forbidden.some((token) => lower.includes(token));
};

const MAX_DRAWS = 100;

// Random base64url spells a year or a team code in roughly 1-3% of draws, so
// redraw rather than hope.
const drawOpaque = (nBytes: number, forbidden: readonly string[], bytes: ByteSource) => {
	for (let attempt = 0; attempt < MAX_DRAWS; attempt++) {
		const id = bytes(nBytes).toString("base64url");
		if (isOpaqueId(id, forbidden)) return id;
	}
	throw new Error(`No opaque id in ${MAX_DRAWS} draws`);
};

export const newImageKey = (forbidden: readonly string[], bytes: ByteSource = randomBytes) =>
	`${DAILY_ERA_IMAGE_PREFIX}${drawOpaque(12, forbidden, bytes)}.webp`;

export const newPuzzleId = (forbidden: readonly string[], bytes: ByteSource = randomBytes) =>
	drawOpaque(9, forbidden, bytes);

export const buildPuzzleEntry = (
	group: PuzzleGroup,
	{ puzzleId, imageKey }: { puzzleId: string; imageKey: string },
): DailyEraPuzzle => ({
	puzzleId,
	imageKey,
	answerSeasons: group.answerSeasons,
	runLabel: formatRunLabel(group.answerSeasons),
	franchise: group.shown.franchise,
	teamName: eraTeamName(group.shown.name) ?? group.shown.franchiseName,
	identities: group.rows.map(jerseyIdentity),
	shownIdentity: jerseyIdentity(group.shown),
});
