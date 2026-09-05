import { Bucket } from "aws-cdk-lib/aws-s3";
import {
    CachePolicy,
    Distribution,
    PriceClass,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";

export interface TeamBuilderAssetsCdnProps {
    appName: string;
    deploymentType: string;
    assetsBucket: Bucket;
}

/**
 * Public, read-only CDN in front of the otherwise fully private assets
 * bucket - for static datasets too heavy to check into the repo the way
 * historicalLogos.json's images are (historical jerseys is the first; see
 * refresh-historical-jerseys.ts). Deployed in both development and
 * production, unlike TeamBuilderWeb, since the picker needs working image
 * URLs locally too.
 *
 * No custom domain: the frontend only ever references these images by their
 * full URL, so the default *.cloudfront.net name is fine, and it avoids
 * TeamBuilderWeb's Route53/ACM dependencies entirely.
 */
export class TeamBuilderAssetsCdn extends Construct {
    readonly distribution: Distribution;

    constructor(scope: Construct, id: string, props: TeamBuilderAssetsCdnProps) {
        super(scope, id);
        const { appName, deploymentType, assetsBucket } = props;

        // Modern OAC helper (not legacy OAI) — CDK attaches the bucket policy
        // granting CloudFront read access automatically, same as
        // TeamBuilderWeb's origin.
        const origin = S3BucketOrigin.withOriginAccessControl(assetsBucket);

        this.distribution = new Distribution(
            this,
            `${appName}-${deploymentType}-assets-distribution`,
            {
                defaultBehavior: {
                    origin,
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: CachePolicy.CACHING_OPTIMIZED,
                },
                // Cost-appropriate for a personal-project audience — easy to
                // change later.
                priceClass: PriceClass.PRICE_CLASS_100,
            },
        );
    }
}
