import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DAILY_ERA_PUZZLES_KEY, DailyEraPuzzle } from "models/daily-era";
import { parsePuzzleList } from "utilities/daily-era";

// The list is append-only, so a stale copy only delays new days: a warm
// container keeps it for 15 minutes rather than re-reading ~430 KB per call.
export const createPuzzleListReader = (
	s3Client: S3Client,
	bucket: string,
	ttlMs = 15 * 60 * 1000,
) => {
	let cached: { at: number; list: DailyEraPuzzle[] } | undefined;

	// Throws on any failure, and never caches one.
	return async (): Promise<DailyEraPuzzle[]> => {
		if (cached && Date.now() - cached.at < ttlMs) return cached.list;
		const { Body } = await s3Client.send(
			new GetObjectCommand({ Bucket: bucket, Key: DAILY_ERA_PUZZLES_KEY }),
		);
		const list = parsePuzzleList(JSON.parse(await Body!.transformToString()));
		cached = { at: Date.now(), list };
		return list;
	};
};
