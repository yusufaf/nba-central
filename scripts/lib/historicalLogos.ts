/**
 * Parsers for the historical-logos dataset.
 *
 * Basketball-Reference tracks 53 NBA/BAA/ABA franchises - active and defunct,
 * including ABA-only clubs that never joined the NBA - and serves one logo
 * image per franchise-season from its CDN. Consecutive seasons that share a
 * logo return byte-identical images, so refresh-historical-logos.ts hashes
 * the downloaded bytes and hands the result to collapseEras() to fold
 * ~1,700 team-seasons down into a few hundred distinct logo eras.
 */
import * as cheerio from "cheerio";

export interface Franchise {
	code: string;
	name: string;
	league: string;
	yearMin: number;
	yearMax: number;
}

export interface Season {
	teamCode: string;
	year: number;
	teamName: string;
}

export interface HashedSeason extends Season {
	hash: string;
}

export interface Era {
	franchise: string;
	franchiseName: string;
	team: string;
	name: string;
	league: string;
	startYear: number;
	endYear: number;
	years: string;
	logoHash: string;
}

// Basketball-Reference season labels are "1975-76"; the CDN and season-page
// URLs key on the season's *end* year, "1976".
const seasonEndYear = (label: string) => parseInt(label.slice(0, 4), 10) + 1;

const seasonLabel = (endYear: number) =>
	`${endYear - 1}-${String(endYear).slice(-2).padStart(2, "0")}`;

export const formatYears = (startYear: number, endYear: number) =>
	startYear === endYear
		? seasonLabel(startYear)
		: `${seasonLabel(startYear)} – ${seasonLabel(endYear)}`;

/**
 * Discovers the current logo CDN base from a franchise season page, e.g.
 * "https://cdn.ssref.net/req/202608270/tlogo/bbr/". Falls back to a pinned
 * version if the layout changes underneath us - the images themselves don't
 * move, only the version segment in the path rotates.
 */
export const parseLogoBase = (seasonPageHtml: string) => {
	const match = seasonPageHtml.match(
		/https:\/\/cdn\.ssref\.net\/req\/\d+\/tlogo\/bbr\//,
	);
	return match?.[0] ?? "https://cdn.ssref.net/req/202106291/tlogo/bbr/";
};

/**
 * Parses the "teams_active" and "teams_defunct" tables on
 * basketball-reference.com/teams/ into every franchise it tracks.
 */
export const parseFranchises = (indexHtml: string): Franchise[] => {
	const $ = cheerio.load(indexHtml);
	const franchises: Franchise[] = [];

	for (const tableId of ["teams_active", "teams_defunct"]) {
		$(`#${tableId} tbody tr.full_table`).each((_, tr) => {
			const row = $(tr);
			const link = row.find('[data-stat="franch_name"] a');
			const code = link.attr("href")?.match(/^\/teams\/([A-Z]+)\/$/)?.[1];
			if (!code) return;

			franchises.push({
				code,
				name: link.text().trim(),
				league: row.find('[data-stat="lg_id"]').text().trim(),
				yearMin: seasonEndYear(
					row.find('[data-stat="year_min"]').text().trim(),
				),
				yearMax: seasonEndYear(
					row.find('[data-stat="year_max"]').text().trim(),
				),
			});
		});
	}

	return franchises;
};

/**
 * Parses a franchise's season-by-season table (id="<CODE>") into one row per
 * season. Deliberately scoped to that one table - the page's nav dropdown
 * repeats /teams/<code>/<year>.html links for all 30 current teams, which
 * would otherwise leak into every franchise's season list.
 */
export const parseFranchiseSeasons = (
	franchiseHtml: string,
	code: string,
): Season[] => {
	const $ = cheerio.load(franchiseHtml);
	const seasons: Season[] = [];

	$(`#${code} tbody tr`).each((_, tr) => {
		const row = $(tr);
		const href = row.find('[data-stat="season"] a').attr("href");
		const match = href?.match(/^\/teams\/([A-Z]+)\/(\d{4})\.html$/);
		if (!match) return;

		// BBRef appends a trailing "*" to a season's team name to mark a
		// playoff berth - a per-season annotation, not part of the name, so
		// it must not make two seasons of the same team look renamed.
		const teamName = row
			.find('[data-stat="team_name"]')
			.text()
			.replace(/\*+$/, "")
			.trim();

		seasons.push({
			teamCode: match[1],
			year: parseInt(match[2], 10),
			teamName,
		});
	});

	return seasons;
};

/**
 * Folds a franchise's hashed seasons (ascending or not - this sorts) into
 * logo eras: a run of consecutive years that share both an image hash and a
 * team name becomes one row. Breaking on name as well as hash keeps
 * search-by-name exact even when a rename happens not to change the logo -
 * two rows can then point at the same image. A code change alone (e.g. the
 * Nuggets' ABA-to-NBA transition) does *not* break an era, since BBRef mints
 * a new team code on league changes even when the logo and name don't move.
 */
export const collapseEras = (
	franchise: Franchise,
	seasons: HashedSeason[],
): Era[] => {
	const sorted = [...seasons].sort((a, b) => a.year - b.year);
	const eras: Era[] = [];

	for (const season of sorted) {
		const current = eras[eras.length - 1];
		if (
			current &&
			current.logoHash === season.hash &&
			current.name === season.teamName &&
			current.endYear === season.year - 1
		) {
			current.endYear = season.year;
			continue;
		}

		eras.push({
			franchise: franchise.code,
			franchiseName: franchise.name,
			team: season.teamCode,
			name: season.teamName,
			league: franchise.league,
			startYear: season.year,
			endYear: season.year,
			years: "",
			logoHash: season.hash,
		});
	}

	for (const era of eras) {
		era.years = formatYears(era.startYear, era.endYear);
	}

	return eras;
};
