/**
 * Joins a player from another source (2K ratings, ESPN rosters) to the
 * Basketball-Reference player it refers to. BBRef ids share nothing with
 * either source, so the join is by name, with suffix, active status and
 * height to break ties.
 */

export interface PoolPlayer {
	id: string;
	first_name: string;
	last_name: string;
	height_feet: number | null;
	height_inches: number | null;
	active: boolean;
}

export interface MatchQuery {
	name: string;
	heightInches: number | null;
	// The other source only lists current players, so a BBRef `active`
	// candidate wins a same-name collision.
	currentOnly: boolean;
}

// Unicode combining diacritical marks, built from escapes so this file stays
// ASCII and can't be mangled in transit.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

// Punctuation that splits a name differently on each side and must be deleted
// rather than spaced out, so "P.J." / "PJ" and "O'Neal" / "O<curly>Neal"
// collapse identically. Includes the curly quotes 2K uses and BBRef does not.
const INTRA_NAME_PUNCTUATION = new RegExp(
	"['\"\\u2018\\u2019\\u201c\\u201d\\u02bc\\u2032.`\\-]",
	"g",
);

/**
 * Players the two sources file under genuinely different names - nicknames,
 * legal name changes, and a couple of 2K misspellings. Normalization can't
 * bridge these, and they're nearly all franchise legends, so they're worth
 * naming explicitly. Keyed 2K name -> Basketball-Reference name.
 */
const NAME_ALIASES: Record<string, string> = {
	"nate archibald": "tiny archibald",
	"penny hardaway": "anfernee hardaway",
	"ron artest": "metta world peace",
	"micheal ray richardson": "michael ray richardson",
	"darrel griffith": "darrell griffith",
	"ronald holland": "ron holland",
};

/**
 * Collapse a name to something comparable across the two sources. BBRef keeps
 * diacritics (e.g. Jokic with an acute accent) and 2K does not; the two also
 * disagree on generational suffixes and on whether initials carry periods
 * ("PJ Dozier" vs "P.J. Dozier", "A.J. Green" vs "AJ Green").
 *
 * Suffixes are dropped so a name always finds its family; telling the members
 * apart is resolveMatch's job.
 */
const baseName = (name: string): string =>
	(name || "")
		.normalize("NFD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase()
		.replace(INTRA_NAME_PUNCTUATION, "")
		.replace(/[^a-z\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const stripSuffix = (name: string): string =>
	name
		.replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();

// Family-level key: "Tim Hardaway" and "Tim Hardaway Jr." share one.
export const normalizeName = (name: string): string => {
	const base = stripSuffix(baseName(name));
	return NAME_ALIASES[base] ?? base;
};

// Individual-level key, suffix intact - used to break family ties.
export const exactName = (name: string): string => {
	const base = baseName(name);
	const aliased = NAME_ALIASES[stripSuffix(base)];
	return aliased ?? base;
};

export const toTotalInches = (
	feet: number | null,
	inches: number | null,
): number | null =>
	feet === null || inches === null ? null : feet * 12 + inches;

// BBRef players by family-level name key.
export const indexByName = (pool: PoolPlayer[]): Map<string, PoolPlayer[]> => {
	const byName = new Map<string, PoolPlayer[]>();
	for (const player of pool) {
		const key = normalizeName(`${player.first_name} ${player.last_name}`);
		if (!key) continue;
		const bucket = byName.get(key);
		if (bucket) bucket.push(player);
		else byName.set(key, [player]);
	}
	return byName;
};

/**
 * Pick the one BBRef player a query refers to, or null if it can't be
 * decided. A wrong join is worse than a miss - it would put Michael Jordan's
 * 99 on a different player - so anything still ambiguous after the height
 * check is dropped rather than guessed at.
 */
export const resolveMatch = (
	candidates: PoolPlayer[],
	query: MatchQuery,
): PoolPlayer | null => {
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0];

	// Both sources carry the suffix, so it settles father/son pairs outright
	// (Glen Rice vs Glen Rice Jr., Ron Harper vs Ron Harper Jr.) - and it has
	// to run before the height check, which can't separate a 6'8" father from
	// his 6'6" son within tolerance.
	const wanted = exactName(query.name);
	const byExactName = candidates.filter(
		(p) => exactName(`${p.first_name} ${p.last_name}`) === wanted,
	);
	if (byExactName.length === 1) return byExactName[0];

	// Current players must be active, which settles the rest of the
	// same-name collisions (Gary Payton, Larry Nance, Jaren Jackson...).
	let pool = byExactName.length > 1 ? byExactName : candidates;
	if (query.currentOnly) {
		const active = pool.filter((p) => p.active);
		if (active.length === 1) return active[0];
		if (active.length > 1) pool = active;
	}

	const wantedInches = query.heightInches;
	if (wantedInches === null) return null;

	const byHeight = pool.filter((p) => {
		const inches = toTotalInches(p.height_feet, p.height_inches);
		return inches !== null && Math.abs(inches - wantedInches) <= 1;
	});

	return byHeight.length === 1 ? byHeight[0] : null;
};
