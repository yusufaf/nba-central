import { EventBridgeEvent, Handler } from "aws-lambda";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CAP_FIVE_MIN_ELIGIBLE, capFiveKey } from "models/cap-five";
import {
	buildCapFivePuzzle,
	eligiblePlayers,
	parseCapFivePuzzle,
	publishDates,
} from "utilities/cap-five";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

const readJson = async <T>(key: string): Promise<T> => {
	const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: staticDataBucket, Key: key }));
	return JSON.parse(await Body!.transformToString()) as T;
};

interface RatingsFile {
	gameVersion: string;
	generated: string;
	data: Record<string, { rating: unknown; ratingSource: unknown; positions?: unknown }>;
}

// Either error means the day is already there.
const ALREADY_PUBLISHED = new Set(["PreconditionFailed", "ConditionalRequestConflict"]);

// Freezes every playable day from puzzle #1 to a week past the newest, each
// into its own object. A day is written once and never again, so the weekly
// ratings refresh never changes a puzzle someone may already have played.
export const handler: Handler = async (event: EventBridgeEvent<string, unknown>, context) => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const [{ data: players = [] }, ratings] = await Promise.all([
		readJson<{ data?: { id: string; first_name: string; last_name: string }[] }>("players.json"),
		readJson<RatingsFile>("player-ratings.json"),
	]);
	const eligible = eligiblePlayers(players, ratings.data ?? {});
	console.log(`${eligible.length} players eligible for Cap Five (${ratings.gameVersion}, ${ratings.generated})`);
	if (eligible.length < CAP_FIVE_MIN_ELIGIBLE) {
		throw new Error(
			`Only ${eligible.length} eligible players (need ${CAP_FIVE_MIN_ELIGIBLE}); the ratings file looks broken, publishing nothing`,
		);
	}

	const meta = { gameVersion: ratings.gameVersion, ratingsGenerated: ratings.generated };
	let published = 0;
	let alreadyThere = 0;
	for (const date of publishDates(Date.now())) {
		const puzzle = parseCapFivePuzzle(buildCapFivePuzzle(date, eligible, meta));
		try {
			await s3Client.send(
				new PutObjectCommand({
					Bucket: staticDataBucket,
					Key: capFiveKey(date),
					Body: JSON.stringify(puzzle),
					ContentType: "application/json",
					IfNoneMatch: "*",
				}),
			);
			published++;
		} catch (err) {
			if (!ALREADY_PUBLISHED.has((err as { name?: string }).name ?? "")) throw err;
			alreadyThere++;
		}
	}
	console.log(`published ${published}, already there ${alreadyThere}`);
};
