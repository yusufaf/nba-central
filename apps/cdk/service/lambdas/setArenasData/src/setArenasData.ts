import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import { parseArenas } from "../../../../scripts/lib/arenas";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context,
): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const response = await fetch(
			"https://en.wikipedia.org/wiki/List_of_NBA_arenas",
		);
		const body = await response.text();

		const data = parseArenas(body);
		if (data.length === 0) {
			throw new Error(
				"No arenas parsed - the Wikipedia table layout likely changed",
			);
		}
		console.log(`Parsed ${data.length} arenas`);

		// Written as a bare array so the object is drop-in compatible with
		// nba-central/src/assets/data/arenas.json, which the frontend imports
		// directly. See the refresh-arenas script.
		const putObjectCommand = new PutObjectCommand({
			Bucket: staticDataBucket,
			Key: "arenas.json",
			Body: JSON.stringify(data, null, 4),
		});
		await s3Client.send(putObjectCommand);
	} catch (err) {
		console.error(err);
	}
};
