import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { capFiveKey, CapFivePuzzle } from "models/cap-five";
import { parseCapFivePuzzle } from "utilities/cap-five";

// A published day never changes (publishCapFive writes it once, with
// IfNoneMatch), so a warm container keeps every one it has found. A miss is
// never cached: the day may be published a moment later.
export const createCapFivePuzzleReader = (s3Client: S3Client, bucket: string) => {
	const cache = new Map<string, CapFivePuzzle>();

	// null when the day isn't published; throws on any other failure.
	return async (date: string): Promise<CapFivePuzzle | null> => {
		const cached = cache.get(date);
		if (cached) return cached;
		let body: string;
		try {
			const { Body } = await s3Client.send(
				new GetObjectCommand({ Bucket: bucket, Key: capFiveKey(date) }),
			);
			body = await Body!.transformToString();
		} catch (err) {
			if ((err as { name?: string }).name === "NoSuchKey") return null;
			throw err;
		}
		const puzzle = parseCapFivePuzzle(JSON.parse(body));
		cache.set(date, puzzle);
		return puzzle;
	};
};
