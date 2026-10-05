/**
 * Parser for the arenas dataset: turns the Wikipedia list of NBA arenas into the rows
 * checked in as apps/web's arenas.json. Used by refresh-arenas.ts.
 */
import * as cheerio from "cheerio";
import { toWikimediaThumbnail } from "../../utilities/general";

// Column order of the "Current arenas" table. Index 0 is the image (read
// separately), 6 is the first-NBA-game season and 7 is the citation; neither
// is used by the frontend.
const INDEX_TO_ATTRIBUTE = new Map([
	[1, "name"],
	[2, "location"],
	[3, "team"],
	[4, "capacity"],
	[5, "openedYear"],
]);

const NUMERIC_ATTRIBUTES = new Set(["openedYear"]);

const LOWEST_EXPECTED_CELL_COUNT = Math.max(...INDEX_TO_ATTRIBUTE.keys()) + 1;

export const parseArenas = (body: string) => {
	const $ = cheerio.load(body);

	// First table --> Current arenas:
	const arenasTable = $(".wikitable").eq(0);

	// Annotated because noImplicitAny is off, which makes a bare `[]` infer as
	// never[] rather than an evolving any[].
	const data: { [key: string]: any }[] = [];
	for (const tr of arenasTable.find("tbody > tr")) {
		const trElement = $(tr);
		const tableCells = trElement.children("td");

		// Header rows hold <th> only, and a row split by a rowspan above it
		// would misalign every column, so skip anything short.
		if (tableCells.length < LOWEST_EXPECTED_CELL_COUNT) {
			continue;
		}

		const arenaData: { [key: string]: any } = {};

		const imageSource = tableCells.eq(0).find("img").attr("src");
		if (imageSource) {
			arenaData.imgLink = toWikimediaThumbnail(imageSource);
		}

		for (const [index, attribute] of INDEX_TO_ATTRIBUTE) {
			const cellText = tableCells.eq(index).text().trim();
			arenaData[attribute] = NUMERIC_ATTRIBUTES.has(attribute)
				? parseInt(cellText, 10)
				: cellText;
		}

		data.push(arenaData);
	}

	return data;
};
