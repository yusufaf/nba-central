import { Bucket } from "aws-cdk-lib/aws-s3";
import {
    CachePolicy,
    Distribution,
    PriceClass,
    ResponseHeadersPolicy,
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
 * bucket - for static image datasets that stay out of the repo (historical
 * jerseys, historical logos, the Home hero clip; see the refresh- and upload-
 * scripts in apps/cdk/scripts). Deployed in both development and
 * production, unlike TeamBuilderWeb, since the pickers need working image
 * URLs locally too.
 *
 * No custom domain: the frontend only ever references these images by their
 * full URL, so the default *.cloudfront.net name is fine, and it avoids
 * TeamBuilderWeb's Route53/ACM dependencies entirely.
 *
 * Attaches the managed CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT response headers
 * policy so images load into a <canvas> (share-card export) without tainting
 * it — a cross-origin image without CORS headers poisons the canvas even
 * though it renders fine as a plain <img>.
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
                    // The share card is rendered in the browser from these
                    // images; without CORS headers a cross-origin <img>
                    // taints the canvas and the export fails. Managed
                    // policy: Access-Control-Allow-Origin: * on every response.
                    responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
                },
                // Cost-appropriate for a personal-project audience — easy to
                // change later.
                priceClass: PriceClass.PRICE_CLASS_100,
            },
        );
    }
}
