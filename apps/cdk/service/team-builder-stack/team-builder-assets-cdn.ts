import { Duration } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
    CacheCookieBehavior,
    CacheHeaderBehavior,
    CachePolicy,
    CacheQueryStringBehavior,
    Distribution,
    PriceClass,
    ResponseHeadersPolicy,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";
// Relative, not "utilities/live-data": cdk.json runs ts-node with no
// tsconfig-paths.
import {
    LIVE_CACHE_MAX_TTL_SECONDS,
    LIVE_JSON_MAX_AGE_SECONDS,
    LIVE_PREFIX,
} from "../../utilities/live-data";

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
 *
 * live/* holds the season files setSeasonContextData writes (standings,
 * schedule and headshots hourly, injuries every 15 minutes). Its own cache
 * policy keeps them fresh even if an object lacks its Cache-Control header,
 * and its max TTL is what
 * lets CloudFront honour the files' stale-if-error when the bucket fails.
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

        const liveDataCachePolicy = new CachePolicy(this, `${appName}-${deploymentType}-live-data`, {
            cachePolicyName: `${appName}-${deploymentType}-live-data`,
            minTtl: Duration.seconds(0),
            defaultTtl: Duration.seconds(LIVE_JSON_MAX_AGE_SECONDS),
            maxTtl: Duration.seconds(LIVE_CACHE_MAX_TTL_SECONDS),
            cookieBehavior: CacheCookieBehavior.none(),
            headerBehavior: CacheHeaderBehavior.none(),
            queryStringBehavior: CacheQueryStringBehavior.none(),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
        });

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
                additionalBehaviors: {
                    [`${LIVE_PREFIX}*`]: {
                        origin,
                        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                        cachePolicy: liveDataCachePolicy,
                        responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
                    },
                },
                // Cost-appropriate for a personal-project audience — easy to
                // change later.
                priceClass: PriceClass.PRICE_CLASS_100,
            },
        );
    }
}
