import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";

const DELETE_OBJECTS_LIMIT = 1000;
// CloudFront allows 3,000 exact paths in progress per distribution.
const INVALIDATION_PATH_LIMIT = 3000;

// Share cards are keyed by team alone (publishTeam), so whoever deletes a
// team has to delete these too: once the team item is gone, nothing leads
// back to them.
export const teamCardsPrefix = (teamUUID: string) => `cards/${teamUUID}/`;

export const chunk = <T>(items: T[], size: number): T[][] =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
		items.slice(i * size, (i + 1) * size),
	);

export const listKeys = async (s3: S3Client, bucket: string, prefix: string): Promise<string[]> => {
	const keys: string[] = [];
	let token: string | undefined;
	do {
		const page = await s3.send(
			new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
		);
		for (const { Key } of page.Contents ?? []) {
			if (Key) keys.push(Key);
		}
		token = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (token);
	return keys;
};

export const deleteKeys = async (s3: S3Client, bucket: string, keys: string[]) => {
	for (const group of chunk(keys, DELETE_OBJECTS_LIMIT)) {
		const { Errors } = await s3.send(
			new DeleteObjectsCommand({
				Bucket: bucket,
				Delete: { Objects: group.map((Key) => ({ Key })), Quiet: true },
			}),
		);
		if (Errors?.length) {
			throw new Error(`Failed to delete ${Errors.length} objects, first: ${Errors[0].Key}`);
		}
	}
};

/**
 * The assets CDN caches each object for a year, so deleted objects are
 * invalidated by exact path. Best effort: a failure is logged, since the
 * objects themselves are already gone.
 */
export const invalidateKeys = async (
	cloudFront: CloudFrontClient,
	distributionId: string,
	keys: string[],
	reference: string,
) => {
	if (!distributionId || keys.length === 0) return;
	for (const [i, group] of chunk(keys, INVALIDATION_PATH_LIMIT).entries()) {
		try {
			await cloudFront.send(
				new CreateInvalidationCommand({
					DistributionId: distributionId,
					InvalidationBatch: {
						CallerReference: `${reference}-${Date.now()}-${i}`,
						Paths: { Quantity: group.length, Items: group.map((key) => `/${key}`) },
					},
				}),
			);
		} catch (err) {
			console.error("Error invalidating deleted objects:", err);
		}
	}
};
