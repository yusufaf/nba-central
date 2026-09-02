import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

// Basketball-Reference `data-stat` -> the key the frontend's `Coach` type
// (nba-central/src/models/types.ts) expects. Anything not listed here is
// dropped rather than written under an undefined key.
const ATTRIBUTE_MAPPING = new Map([
	["ranker", "rank"],
	["coach", "name"],
	["season_min", "from"],
	["season_max", "to"],
	["years", "yrs"],
	["g", "g"],
	["wins", "w"],
	["losses", "l"],
	["win_loss_pct", "wlPercent"],
	["wins_over_500", "wGreaterThan500"],
	["g_playoffs", "playoffG"],
	["wins_playoffs", "playoffW"],
	["losses_playoffs", "playoffL"],
	["win_loss_pct_playoffs", "playoffWLPercent"],
	["years_conference_champion", "confTitles"],
	["years_league_champion", "championships"],
]);

// The frontend renders these verbatim - coachWinPercent() in CoachSection.vue
// returns "0%" for anything numeric, so a parsed ".671" would silently show as
// 0% across the drawer.
const STRING_ATTRIBUTES = new Set(["name", "wlPercent", "playoffWLPercent"]);

export const parseCoaches = (body: string) => {
	const $ = cheerio.load(body);

	const tbodyElement = $("#coaches > tbody");

	// Annotated because noImplicitAny is off, which makes a bare `[]` infer as
	// never[] rather than an evolving any[].
	const data: { [key: string]: any }[] = [];
	for (const tr of tbodyElement.children()) {
		const trElement = $(tr);
		// The column headers are repeated every 20 rows or so.
		if (trElement.hasClass("thead")) {
			continue;
		}

		const coachData: { [key: string]: any } = {};
		for (const td of trElement.children()) {
			const tdElement = $(td);
			const dataStatValue = tdElement.data("stat") as string;
			if (!dataStatValue) {
				continue;
			}

			// Upstream renames columns from time to time (season_min used to be
			// year_min). Skipping the unmapped case keeps a rename from writing
			// an "undefined" key; the refresh scripts' row validation is what
			// turns the resulting missing field into a loud failure.
			const property = ATTRIBUTE_MAPPING.get(dataStatValue);
			if (!property) {
				continue;
			}

			// The trailing "*" on Hall of Famers has to survive - isHallOfFamer()
			// in CoachSection.vue keys off it.
			const tdText = tdElement.text().trim();

			if (property === "name") {
				const href = tdElement.children().first().attr("href");
				if (href) {
					coachData.href = href;
				}
			}

			// A coach with no playoff appearances has an empty win_loss_pct_playoffs
			// cell. Fall back to "0" (matching the numeric columns' fallback) so
			// coachWinPercent() in CoachSection.vue doesn't parseFloat("") into NaN.
			coachData[property] = STRING_ATTRIBUTES.has(property)
				? tdText || "0"
				: parseFloat(tdText || "0");
		}

		if (Object.keys(coachData).length > 0) {
			data.push(coachData);
		}
	}

	return data;
};

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context,
): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const response = await fetch(
			"https://www.basketball-reference.com/coaches/NBA_stats.html",
		);
		const body = await response.text();

		const data = parseCoaches(body);
		if (data.length === 0) {
			throw new Error(
				"No coaches parsed - the Basketball-Reference table layout likely changed",
			);
		}
		console.log(`Parsed ${data.length} coaches`);

		// Written as a bare array so the object is drop-in compatible with
		// nba-central/src/assets/data/coaches.json, which the frontend imports
		// directly. See the refresh-coaches script.
		const putObjectCommand = new PutObjectCommand({
			Bucket: staticDataBucket,
			Key: "coaches.json",
			Body: JSON.stringify(data, null, 4),
		});
		await s3Client.send(putObjectCommand);
	} catch (err) {
		console.error(err);
	}
};
