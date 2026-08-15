import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

// Basketball-Reference `data-stat` -> the key the frontend's `GM` type
// (nba-central/src/models/types.ts) expects.
const ATTRIBUTE_MAPPING = new Map([
	["exec", "name"],
	["teams", "teams"],
]);

// Basketball-Reference separates a team abbreviation from its year range with a
// non-breaking space. Written as an escape so it stays visible in a diff.
const NON_BREAKING_SPACE = /\u00A0/g;

// Stints are comma-separated, but a stint's own year range can contain a comma
// ("UTA (2021, -22)"), so only split on a comma that closes a range.
const STINT_SEPARATOR = /(?<=\)),\s*/;

export const parseExecs = (body: string) => {
	const $ = cheerio.load(body);

	const tbodyElement = $("#executives-index > tbody");

	// Annotated because noImplicitAny is off, which makes a bare `[]` infer as
	// never[] rather than an evolving any[].
	const data: { [key: string]: any }[] = [];
	for (const tr of tbodyElement.children()) {
		const trElement = $(tr);
		// Both the letter dividers and the repeated column headers carry .thead.
		if (trElement.hasClass("thead")) {
			continue;
		}

		const execData: { [key: string]: any } = {};
		for (const element of trElement.children()) {
			const cheerioElement = $(element);
			const dataStatValue = cheerioElement.data("stat") as string;
			if (!dataStatValue) {
				continue;
			}

			const property = ATTRIBUTE_MAPPING.get(dataStatValue);
			if (!property) {
				continue;
			}

			// Only the non-breaking spaces need normalising - stripping periods
			// as well would turn "R.C. Buford" into "RC Buford".
			const cellText = cheerioElement
				.text()
				.replace(NON_BREAKING_SPACE, " ")
				.trim();

			switch (property) {
				case "name": {
					// Active executives are listed in bold.
					execData.active = cheerioElement.find("strong").length > 0;
					execData.href = cheerioElement.find("a").attr("href") ?? "";
					execData.name = cellText;
					break;
				}
				case "teams": {
					execData.teams = cellText
						.split(STINT_SEPARATOR)
						.map((stint) => stint.trim())
						.filter(Boolean);
					break;
				}
			}
		}

		if (Object.keys(execData).length > 0) {
			data.push(execData);
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
			"https://www.basketball-reference.com/executives/",
		);
		const body = await response.text();

		const data = parseExecs(body);
		if (data.length === 0) {
			throw new Error(
				"No executives parsed - the Basketball-Reference table layout likely changed",
			);
		}
		console.log(`Parsed ${data.length} executives`);

		// Written as a bare array so the object is drop-in compatible with
		// nba-central/src/assets/data/execs.json, which the frontend imports
		// directly. See the refresh-execs script.
		const putObjectCommand = new PutObjectCommand({
			Bucket: staticDataBucket,
			Key: "execs.json",
			Body: JSON.stringify(data, null, 4),
		});
		const putObjectResponse = await s3Client.send(putObjectCommand);
	} catch (err) {
		console.error(err);
	}
};
