/**
 * Resolves the assets S3 bucket and the CloudFront distribution
 * TeamBuilderAssetsCdn puts in front of it, for scripts that upload into that
 * bucket. Originally lived only in refresh-historical-jerseys.ts; pulled out
 * here so upload-hero-video.ts (and any future asset uploader) shares it
 * instead of copying it.
 */
import { S3Client } from "@aws-sdk/client-s3";
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
