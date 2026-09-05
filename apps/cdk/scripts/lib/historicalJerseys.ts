/**
 * Parsers for the historical-jerseys dataset.
 *
 * The Basketball Jersey Database (bballjerseys.com) is a Wix site: each team
 * page embeds one or more Wix Pro Gallery components, and the gallery's items
 * are fetched from an undocumented but anonymous REST API once a per-app
 * "instance" token is read off the page. Unlike Basketball-Reference's one
 * image per franchise-season, this source already publishes one image per
 * distinct jersey design with an explicit list of the seasons it was worn -
 * there is nothing to hash-and-collapse here, just parse.
 *
 * Two of the 42 jersey pages (Celtics, Thunder) have migrated off the Pro
 * Gallery app and return zero items from that API; Wix still server-renders
 * the same gallery markup into the page HTML, just without the JSON backing
 * it, so parseServerRenderedItems recovers an equivalent (if less detailed)
 * item list directly from the DOM. Both paths normalize to the same
 * RawGalleryItem shape so every downstream parser is shared.
 */
import * as cheerio from "cheerio";

export interface RawGalleryItem {
	mediaUrl: string;
	title: string;
	description: string;
}

export interface SeasonSpan {
	seasons: string[];
	startYear: number;
	endYear: number;
}

export type HistoricalJerseySlot = "home-road" | "alternate" | "special";

export interface ParsedJersey {
	franchise: string;
	franchiseName: string;
	name: string;
	league: string;
	slot: HistoricalJerseySlot;
	startYear: number;
	endYear: number;
	years: string;
	seasons: string[];
}

// The sitemap lists every page on the site, not just jersey galleries.
const EXCLUDED_PAGE_SLUGS = new Set([
	"",
	"contact",
	"blog",
	"updates",
	"credits",
	"nba-season",
]);

/** Parses bballjerseys.com/pages-sitemap.xml into jersey-gallery page slugs. */
export const parsePageSlugs = (sitemapXml: string): string[] => {
	const $ = cheerio.load(sitemapXml, { xmlMode: true });
	const slugs: string[] = [];

	$("url > loc").each((_, el) => {
		const slug = new URL($(el).text().trim()).pathname.replace(/^\//, "");
		if (!EXCLUDED_PAGE_SLUGS.has(slug)) {
			slugs.push(slug);
		}
	});

	return slugs;
};

/**
 * Pulls every Pro Gallery `galleryId` out of a page's `wix-warmup-data` JSON
 * blob. Matched by re-stringifying and regexing rather than walking the
 * parsed object, since the blob's shape is Wix's internal SSR cache and the
 * path to a given gallery's id has already varied across page shapes seen on
 * this site - the id itself is a stable, recognizable UUID wherever it sits.
 */
export const extractGalleryIds = (pageHtml: string): string[] => {
	const $ = cheerio.load(pageHtml);
	const raw = $('script#wix-warmup-data[type="application/json"]').first().html();
	if (!raw) return [];

	let blob: unknown;
	try {
		blob = JSON.parse(raw);
	} catch {
		return [];
	}

	const matches = JSON.stringify(blob).match(/"galleryId":"([a-f0-9-]{36})"/g) ?? [];
	return [...new Set(matches.map((m) => m.slice('"galleryId":"'.length, -1)))];
};

/** Parses a Pro Gallery API response body into normalized gallery items. */
export const parseGalleryItems = (responseBody: string): RawGalleryItem[] => {
	const json = JSON.parse(responseBody);
	const items: any[] = json?.gallery?.items ?? [];

	return items
		.filter((item) => item?.dataType === "Photo" && typeof item?.mediaUrl === "string")
		.map((item) => ({
			mediaUrl: item.mediaUrl,
			title: (item.title ?? "").trim(),
			description: item.description ?? "",
		}));
};

/**
 * Recovers gallery items from the server-rendered DOM on a page whose Pro
 * Gallery API returns nothing (Celtics, Thunder as of this writing - see the
 * module doc). `data-id="boston-celtics-1946-1947-home-and-road-jersey_0"`
 * de-slugs into the display title the API would have supplied as `title`;
 * there is no equivalent of the API's per-season `description`, so the title
 * carries the only date information available and parseSeasonSpan falls back
 * to reading a year range out of it.
 */
export const parseServerRenderedItems = (pageHtml: string): RawGalleryItem[] => {
	const $ = cheerio.load(pageHtml);
	const seenMediaIds = new Set<string>();
	const results: RawGalleryItem[] = [];

	$('[data-hook="item-link-wrapper"]').each((_, el) => {
		const dataId = $(el).attr("data-id");
		const src = $(el).find('img[data-hook="gallery-item-image-img"]').first().attr("src");
		if (!dataId || !src) return;

		const mediaId = src.match(/\/media\/([^/]+~mv2\.\w+)/)?.[1];
		if (!mediaId || seenMediaIds.has(mediaId)) return;
		seenMediaIds.add(mediaId);

		const title = dataId
			.replace(/_\d+$/, "")
			.split("-")
			.map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
			.join(" ");

		results.push({
			mediaUrl: `https://static.wixstatic.com/media/${mediaId}`,
			title,
			description: "",
		});
	});

	return results;
};

const SEASON_LINE = /^(\d{4})\/(\d{2})$/;
const seasonEndYear = (label: string) => parseInt(label.slice(0, 4), 10) + 1;

/**
 * A gallery item's `description` leads with one "1946/47"-style line per
 * season the design was worn, e.g. "1946/47\n1947/48\n\nNotable Numbers:
 * ...": everything from the first non-season line on is freeform trivia, not
 * part of the span. Converts each line to the "1946-47" label the rest of
 * the app uses (matching HistoricalLogo's `formatYears` inputs) and derives
 * the season-*end*-year bounds from the first and last of them.
 */
export const parseSeasonSpanFromDescription = (description: string): SeasonSpan | null => {
	const seasons: string[] = [];
	for (const rawLine of description.split("\n")) {
		const line = rawLine.trim();
		if (!SEASON_LINE.test(line)) break;
		seasons.push(line.replace("/", "-"));
	}
	if (seasons.length === 0) return null;

	return {
		seasons,
		startYear: seasonEndYear(seasons[0]),
		endYear: seasonEndYear(seasons[seasons.length - 1]),
	};
};

/**
 * Falls back to the year range embedded in a title/de-slugged title itself,
 * e.g. "New York Knicks 1946-1953 Home and Road Jersey" or "Boston Celtics
 * 2017 Present Association Jersey" (present tense from a "-present" slug).
 * By this site's convention the first number is the opening season's start
 * calendar year and the second is the closing season's end calendar year -
 * so "1946-1953" spans the 1946-47 season through 1952-53, matching
 * `parseSeasonSpanFromDescription`'s startYear/endYear exactly, without
 * needing to enumerate every season in between. A lone year (no second
 * number) is treated as already being that single season's end year, e.g.
 * "2018 City Jersey" for the 2017-18 season - this site's usual shorthand.
 * There is no explicit season list to recover this way, so `seasons` is left
 * empty.
 */
export const parseSeasonSpanFromTitle = (
	title: string,
	nowYear: number = new Date().getFullYear(),
): SeasonSpan | null => {
	const range = title.match(/(\d{4})[\s-]+(\d{4}|Present)(?!\d)/i);
	if (range) {
		const startYear = parseInt(range[1], 10) + 1;
		const endYear = /present/i.test(range[2]) ? nowYear + 1 : parseInt(range[2], 10);
		return { seasons: [], startYear, endYear };
	}

	const single = title.match(/(?<!\d)(\d{4})(?!\d)/);
	if (!single) return null;
	const endYear = parseInt(single[1], 10);
	return { seasons: [], startYear: endYear, endYear };
};

export const parseSeasonSpan = (
	item: RawGalleryItem,
	nowYear?: number,
): SeasonSpan | null =>
	parseSeasonSpanFromDescription(item.description) ?? parseSeasonSpanFromTitle(item.title, nowYear);

/**
 * Best-effort slot bucket from a title's wording. The site's own taxonomy is
 * far richer than this (Statement, City, Classic, Earned, Noche Latina, ring
 * nights...) - this collapses it to the three buckets the picker filters by,
 * treating the modern Nike-era Association/Icon editions as the current
 * equivalent of home/road and Statement as the current alternate.
 */
export const classifySlot = (title: string): HistoricalJerseySlot => {
	const lower = title.toLowerCase();
	if (/\b(alternate|statement)\b/.test(lower)) return "alternate";
	if (/\b(home|road|association|icon)\b/.test(lower) && !lower.includes("throwback")) {
		return "home-road";
	}
	return "special";
};

// Page slugs that map onto exactly one HistoricalLogo franchise code. Built
// by hand against apps/web/src/assets/data/historicalLogos.json's franchise
// list - "sonics" and "thunder" both fold into "OKC" there (one franchise,
// renamed), matching how the logos dataset already treats that history.
export const SLUG_FRANCHISE: Record<string, string> = {
	grizzlies: "MEM",
	suns: "PHO",
	thunder: "OKC",
	nets: "NJN",
	pistons: "DET",
	hawks: "ATL",
	heat: "MIA",
	cavaliers: "CLE",
	spurs: "SAS",
	kings: "SAC",
	jazz: "UTA",
	bucks: "MIL",
	sonics: "OKC",
	sixers: "PHI",
	pelicans: "NOH",
	lakers: "LAL",
	wizards: "WAS",
	timberwolves: "MIN",
	rockets: "HOU",
	raptors: "TOR",
	clippers: "LAC",
	knicks: "NYK",
	pacers: "IND",
	hornets: "CHA",
	mavericks: "DAL",
	blazers: "POR",
	bulls: "CHI",
	magic: "ORL",
	warriors: "GSW",
	celtics: "BOS",
	nuggets: "DEN",
	"aba-sails": "SDS",
	"aba-colonels": "KEN",
	"aba-condors": "PTC",
	"aba-squires": "VIR",
	"aba-floridians": "FLO",
	"aba-spirits": "SSL",
	"aba-sounds": "MMS",
	"aba-stars": "UTS",
};

/**
 * Resolves a gallery item's franchise. Most pages map 1:1 to a franchise via
 * SLUG_FRANCHISE; "defunct" mixes several one-season BAA franchises on one
 * page instead, so those are resolved per item by matching the team name at
 * the front of its title against historicalLogos.json's own names (longest
 * match first, so "St. Louis Bombers" isn't shadowed by a shorter false
 * positive). A handful of teams on that page folded before ever posting a
 * logo Basketball-Reference tracks and have no match at all - franchise is
 * left "" for those rather than guessed.
 */
export const resolveFranchise = (
	slug: string,
	title: string,
	franchiseNames: Record<string, string>,
): { franchise: string; franchiseName: string; league: string } => {
	if (slug === "nba-allstar") {
		return { franchise: "", franchiseName: "NBA All-Star", league: "All-Star" };
	}
	if (slug === "aba-allstar") {
		return { franchise: "", franchiseName: "ABA All-Star", league: "All-Star" };
	}

	const mapped = SLUG_FRANCHISE[slug];
	if (mapped) {
		return {
			franchise: mapped,
			franchiseName: franchiseNames[mapped] ?? mapped,
			league: slug.startsWith("aba-") ? "ABA" : "NBA",
		};
	}

	const match = Object.entries(franchiseNames)
		.filter(([, name]) => title.startsWith(name))
		.sort((a, b) => b[1].length - a[1].length)[0];

	return match
		? { franchise: match[0], franchiseName: match[1], league: "NBA" }
		: { franchise: "", franchiseName: "", league: "NBA" };
};

export const formatJerseyYears = (startYear: number, endYear: number) => {
	const seasonLabel = (endYr: number) =>
		`${endYr - 1}-${String(endYr).slice(-2).padStart(2, "0")}`;
	return startYear === endYear
		? seasonLabel(startYear)
		: `${seasonLabel(startYear)} – ${seasonLabel(endYear)}`;
};

/**
 * Assembles one gallery item plus its page context into a dataset row, or
 * null (with a problem recorded) when no season span could be parsed from
 * either its description or its title - the one case that should never
 * happen on a real page and signals the upstream layout changed.
 */
export const buildParsedJersey = (
	item: RawGalleryItem,
	slug: string,
	franchiseNames: Record<string, string>,
	problems: string[],
	nowYear?: number,
): ParsedJersey | null => {
	const span = parseSeasonSpan(item, nowYear);
	if (!span) {
		problems.push(`${slug}: "${item.title}" has no parseable season span`);
		return null;
	}

	const { franchise, franchiseName, league } = resolveFranchise(slug, item.title, franchiseNames);

	return {
		franchise,
		franchiseName,
		name: item.title,
		league,
		slot: classifySlot(item.title),
		startYear: span.startYear,
		endYear: span.endYear,
		years: formatJerseyYears(span.startYear, span.endYear),
		seasons: span.seasons,
	};
};
