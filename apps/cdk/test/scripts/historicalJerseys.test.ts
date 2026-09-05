import { describe, it, expect } from "vitest";
import {
	buildParsedJersey,
	classifySlot,
	currentSeasonEndYear,
	extractGalleryIds,
	formatJerseyYears,
	parseGalleryItems,
	parsePageSlugs,
	parseServerRenderedItems,
	parseSeasonSpan,
	parseSeasonSpanFromDescription,
	parseSeasonSpanFromTitle,
	resolveFranchise,
	type RawGalleryItem,
} from "../../scripts/lib/historicalJerseys";

describe("parsePageSlugs", () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url><loc>https://www.bballjerseys.com/knicks</loc></url>
	<url><loc>https://www.bballjerseys.com/aba-squires</loc></url>
	<url><loc>https://www.bballjerseys.com/contact</loc></url>
	<url><loc>https://www.bballjerseys.com/blog</loc></url>
	<url><loc>https://www.bballjerseys.com</loc></url>
</urlset>`;

	it("keeps jersey-gallery pages and drops the site's non-jersey pages", () => {
		expect(parsePageSlugs(xml)).toEqual(["knicks", "aba-squires"]);
	});
});

describe("extractGalleryIds", () => {
	it("pulls every galleryId out of the wix-warmup-data blob, deduplicated", () => {
		const html = `<html><body><script type="application/json" id="wix-warmup-data">
			{"apps":{"someApp":{"widgets":{"gallery1":{"data":{"galleryId":"5e3f11b4-be0a-4df0-80a8-8f134fa71f88"}}}},"other":{"galleryId":"5e3f11b4-be0a-4df0-80a8-8f134fa71f88"},"third":{"galleryId":"3f4a2b25-319a-410f-abd8-2f3ee8c2011c"}}}
		</script></body></html>`;

		expect(extractGalleryIds(html)).toEqual([
			"5e3f11b4-be0a-4df0-80a8-8f134fa71f88",
			"3f4a2b25-319a-410f-abd8-2f3ee8c2011c",
		]);
	});

	it("returns an empty list when the page carries no warmup-data script", () => {
		expect(extractGalleryIds("<html></html>")).toEqual([]);
	});
});

describe("parseGalleryItems", () => {
	// Trimmed real shape of a Pro Gallery API response, including a non-Photo
	// item (Wix galleries can carry text/video blocks) that must be filtered.
	const body = JSON.stringify({
		gallery: {
			id: "3f4a2b25-319a-410f-abd8-2f3ee8c2011c",
			totalItemsCount: 2,
			items: [
				{
					id: "1d3d0110-599e-49d6-9936-f80eebd9eee9",
					mediaUrl: "https://static.wixstatic.com/media/31d308_5022~mv2.png",
					name: "Knicks 01_New York Knicks 1946-1953 Jersey A.png",
					title: "New York Knicks 1946-1953 Home and Road Jersey",
					description:
						"1946/47\n1947/48\n1948/49\n1949/50\n1950/51\n1951/52\n1952/53\n\nNotable Numbers:\n#4 - Carl Braun",
					dataType: "Photo",
				},
				{ id: "text-block", dataType: "Text" },
			],
		},
	});

	it("keeps only photo items and normalizes their fields", () => {
		expect(parseGalleryItems(body)).toEqual([
			{
				mediaUrl: "https://static.wixstatic.com/media/31d308_5022~mv2.png",
				title: "New York Knicks 1946-1953 Home and Road Jersey",
				description:
					"1946/47\n1947/48\n1948/49\n1949/50\n1950/51\n1951/52\n1952/53\n\nNotable Numbers:\n#4 - Carl Braun",
			},
		]);
	});
});

describe("parseServerRenderedItems", () => {
	// Distilled but real markup from bballjerseys.com/celtics, one of the two
	// pages whose Pro Gallery API returns zero items (see the module doc).
	const html = `<html><body><div class="pro-gallery-margin-container">
		<div data-id="boston-celtics-1946-1947-home-and-road-jersey_0" class="item-link-wrapper" data-hook="item-link-wrapper">
			<div data-hook="item-wrapper"><div data-hook="image-item"><picture>
				<img data-hook="gallery-item-image-img" src="https://static.wixstatic.com/media/31d308_0dbaa9~mv2.png/v1/fill/w_317,h_316,q_90,enc_avif,quality_auto/31d308_0dbaa9~mv2.png" alt="Notable Numbers: #10 - Connie Simmons"/>
			</picture></div></div>
		</div>
		<div data-id="boston-celtics-1947-1949-home-and-road-jersey_1" class="item-link-wrapper" data-hook="item-link-wrapper">
			<div data-hook="item-wrapper"><div data-hook="image-item"><picture>
				<img data-hook="gallery-item-image-img" src="https://static.wixstatic.com/media/31d308_fa1fd4~mv2.png/v1/fill/w_317,h_316,q_90,enc_avif,quality_auto/31d308_fa1fd4~mv2.png" alt="Notable Numbers: #22 - Ed Sadowski"/>
			</picture></div></div>
		</div>
	</div></body></html>`;

	it("de-slugs data-id into a display title and recovers the bare media URL", () => {
		expect(parseServerRenderedItems(html)).toEqual([
			{
				mediaUrl: "https://static.wixstatic.com/media/31d308_0dbaa9~mv2.png",
				title: "Boston Celtics 1946 1947 Home And Road Jersey",
				description: "",
			},
			{
				mediaUrl: "https://static.wixstatic.com/media/31d308_fa1fd4~mv2.png",
				title: "Boston Celtics 1947 1949 Home And Road Jersey",
				description: "",
			},
		]);
	});
});

describe("parseSeasonSpanFromDescription", () => {
	it("reads a run of season lines and stops at the first non-season line", () => {
		expect(
			parseSeasonSpanFromDescription("1946/47\n1947/48\n\nNotable Numbers:\n#4 - Carl Braun"),
		).toEqual({
			seasons: ["1946-47", "1947-48"],
			startYear: 1947,
			endYear: 1948,
		});
	});

	it("handles a single season", () => {
		expect(parseSeasonSpanFromDescription("1995/96")).toEqual({
			seasons: ["1995-96"],
			startYear: 1996,
			endYear: 1996,
		});
	});

	it("returns null when the description has no season line at all", () => {
		expect(parseSeasonSpanFromDescription("Notable Numbers:\n#9 - John Doe")).toBeNull();
	});
});

describe("currentSeasonEndYear", () => {
	it("stays in the current calendar year before the season tips off in October", () => {
		expect(currentSeasonEndYear(new Date(2026, 8, 5))).toBe(2026); // Sept 5, 2026
	});

	it("rolls over to next calendar year once the new season has started", () => {
		expect(currentSeasonEndYear(new Date(2026, 9, 15))).toBe(2027); // Oct 15, 2026
	});
});

describe("parseSeasonSpanFromTitle", () => {
	it("reads a start-to-end year range", () => {
		expect(parseSeasonSpanFromTitle("New York Knicks 1946-1953 Home and Road Jersey")).toEqual({
			seasons: [],
			startYear: 1947,
			endYear: 1953,
		});
	});

	it("treats a '-present' range as ending at the season now in progress", () => {
		// The second parameter is the *season's* end year, not a calendar
		// year - 2026 here means "the 2025-26 season is the one in progress".
		expect(
			parseSeasonSpanFromTitle("Boston Celtics 2017-present Association Jersey", 2026),
		).toEqual({ seasons: [], startYear: 2018, endYear: 2026 });
	});

	it("treats a lone year as already being the season's end year", () => {
		expect(parseSeasonSpanFromTitle("Boston Celtics 2018 City Jersey")).toEqual({
			seasons: [],
			startYear: 2018,
			endYear: 2018,
		});
	});

	it("returns null when the title carries no year at all", () => {
		expect(parseSeasonSpanFromTitle("Boston Celtics Jersey")).toBeNull();
	});
});

describe("parseSeasonSpan", () => {
	it("prefers the description's explicit season list over the title", () => {
		const item: RawGalleryItem = {
			mediaUrl: "x",
			title: "New York Knicks 1946-1953 Home and Road Jersey",
			description: "1946/47",
		};
		expect(parseSeasonSpan(item)).toEqual({ seasons: ["1946-47"], startYear: 1947, endYear: 1947 });
	});

	it("falls back to the title when the description carries no season list", () => {
		const item: RawGalleryItem = {
			mediaUrl: "x",
			title: "Boston Celtics 1946 1947 Home And Road Jersey",
			description: "",
		};
		expect(parseSeasonSpan(item)).toEqual({ seasons: [], startYear: 1947, endYear: 1947 });
	});
});

describe("classifySlot", () => {
	it.each([
		["New York Knicks 1946-1953 Home and Road Jersey", "home-road"],
		["New York Knicks Alternate Jersey 1995-1997", "alternate"],
		["Boston Celtics 2017-2020 Statement Jersey", "alternate"],
		["Boston Celtics 2017-present Association Jersey", "home-road"],
		["New York Knicks Hardwood Classic Jersey 2004-2005", "special"],
		["New York Knicks Home Throwback Jersey 1996-1997", "special"],
	] as const)("classifies %s as %s", (title, expected) => {
		expect(classifySlot(title)).toBe(expected);
	});
});

describe("resolveFranchise", () => {
	const franchiseNames = {
		NYK: "New York Knicks",
		STB: "St. Louis Bombers",
		PRO: "Providence Steamrollers",
	};

	it("resolves a page slug mapped directly to a franchise", () => {
		expect(resolveFranchise("knicks", "New York Knicks 1946-1953 Home and Road Jersey", franchiseNames)).toEqual({
			franchise: "NYK",
			franchiseName: "New York Knicks",
			league: "NBA",
		});
	});

	it("tags an ABA page slug with the ABA league", () => {
		expect(resolveFranchise("aba-squires", "Virginia Squires 1970-1971 Jersey", { VIR: "Virginia Squires" })).toMatchObject(
			{ league: "ABA" },
		);
	});

	it("resolves the two all-star pages without a franchise join", () => {
		expect(resolveFranchise("nba-allstar", "1988 NBA All-Star Jersey", {})).toEqual({
			franchise: "",
			franchiseName: "NBA All-Star",
			league: "All-Star",
		});
	});

	it("resolves a multi-team page's item by the longest matching name in its title", () => {
		expect(resolveFranchise("defunct", "St. Louis Bombers 1948-1949 Home and Road Jersey", franchiseNames)).toEqual(
			{ franchise: "STB", franchiseName: "St. Louis Bombers", league: "NBA" },
		);
	});

	it("leaves franchise empty for a defunct-page team with no logos-dataset match", () => {
		expect(resolveFranchise("defunct", "Detroit Falcons 1946-1947 Home and Road Jersey", franchiseNames)).toEqual(
			{ franchise: "", franchiseName: "", league: "NBA" },
		);
	});
});

describe("formatJerseyYears", () => {
	it("renders a single season as one label", () => {
		expect(formatJerseyYears(1996, 1996)).toBe("1995-96");
	});

	it("renders a span as two labels joined by an en dash", () => {
		expect(formatJerseyYears(1947, 1953)).toBe("1946-47 – 1952-53");
	});
});

describe("buildParsedJersey", () => {
	const franchiseNames = { NYK: "New York Knicks" };

	it("assembles a full row from a gallery item and its page context", () => {
		const item: RawGalleryItem = {
			mediaUrl: "https://static.wixstatic.com/media/31d308_5022~mv2.png",
			title: "New York Knicks 1946-1953 Home and Road Jersey",
			description: "1946/47\n1947/48\n\nNotable Numbers:\n#4 - Carl Braun",
		};
		const problems: string[] = [];

		expect(buildParsedJersey(item, "knicks", franchiseNames, problems)).toEqual({
			franchise: "NYK",
			franchiseName: "New York Knicks",
			name: "New York Knicks 1946-1953 Home and Road Jersey",
			league: "NBA",
			slot: "home-road",
			startYear: 1947,
			endYear: 1948,
			years: "1946-47 – 1947-48",
			seasons: ["1946-47", "1947-48"],
		});
		expect(problems).toEqual([]);
	});

	it("records a problem and returns null when no season span can be parsed", () => {
		const item: RawGalleryItem = { mediaUrl: "x", title: "New York Knicks Jersey", description: "" };
		const problems: string[] = [];

		expect(buildParsedJersey(item, "knicks", franchiseNames, problems)).toBeNull();
		expect(problems).toEqual(['knicks: "New York Knicks Jersey" has no parseable season span']);
	});
});
