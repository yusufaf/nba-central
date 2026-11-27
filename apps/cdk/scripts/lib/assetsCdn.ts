/**
 * Resolves the assets S3 bucket and the CloudFront distribution
 * TeamBuilderAssetsCdn puts in front of it, for scripts that upload into that
 * bucket. Originally lived only in refresh-historical-jerseys.ts; pulled out
 * here so upload-hero-video.ts (and any future asset uploader) shares it
 * instead of copying it. uploadIfMissing is the upload step shared by the
 * scripts that store content-addressed images.
 */
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";

export interface AssetsCdnUpload {
	s3Client: S3Client;
	bucketName: string;
	distributionDomain: string;
}

export const setupAssetsCdnUpload = async (): Promise<AssetsCdnUpload> => {
	const { region, appName, deploymentType } = process.env;
	if (!region || !appName || !deploymentType) {
		throw new Error(
			"Uploading requires apps/cdk's .env (region, appName, deploymentType) - see apps/cdk/CLAUDE.md. Pass --check to validate without uploading.",
		);
	}

	const bucketName = `${appName}-${deploymentType}-assets`;
	const s3Client = new S3Client({ region });

	// CloudFront is a global service fronted by a single us-east-1 API
	// endpoint, regardless of where the origin bucket lives.
	const cloudFrontClient = new CloudFrontClient({ region: "us-east-1" });
	let marker: string | undefined;
	let distribution;
	do {
		const { DistributionList } = await cloudFrontClient.send(
			new ListDistributionsCommand({ Marker: marker }),
		);
		distribution = DistributionList?.Items?.find((item) =>
			item.Origins?.Items?.some((origin) => origin.DomainName?.startsWith(`${bucketName}.s3.`)),
		);
		marker = DistributionList?.IsTruncated ? DistributionList?.NextMarker : undefined;
	} while (!distribution && marker);
	if (!distribution?.DomainName) {
		throw new Error(
			`No CloudFront distribution found fronting ${bucketName} - deploy TeamBuilderAssetsCdn first (cdk deploy)`,
		);
	}

	return { s3Client, bucketName, distributionDomain: distribution.DomainName };
};

/**
 * Puts a content-addressed object in the assets bucket unless one already
 * sits at its key - identical key means identical bytes, so a re-run skips it
 * instead of stacking versions on the versioned bucket. Returns whether an
 * upload actually happened.
 */
export const uploadIfMissing = async (
	upload: AssetsCdnUpload,
	objectKey: string,
	body: Uint8Array,
	contentType: string,
): Promise<boolean> => {
	try {
		await upload.s3Client.send(
			new HeadObjectCommand({ Bucket: upload.bucketName, Key: objectKey }),
		);
		return false;
	} catch (err) {
		// S3 answers a HEAD on a missing key with 404, or 403 when the caller
		// lacks s3:ListBucket - either way, fall through and try the upload.
		const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
		if (status !== 404 && status !== 403) throw err;
	}
	await upload.s3Client.send(
		new PutObjectCommand({
			Bucket: upload.bucketName,
			Key: objectKey,
			Body: body,
			ContentType: contentType,
			// The hash in the key is the whole cache-busting mechanism - this
			// object's content never changes at this key, so cache it hard.
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);
	return true;
};
