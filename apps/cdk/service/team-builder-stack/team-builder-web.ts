import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import {
	AllowedMethods,
	CacheCookieBehavior,
	CacheHeaderBehavior,
	CachePolicy,
	CacheQueryStringBehavior,
	Distribution,
	Function as CloudFrontFunction,
	FunctionCode,
	FunctionEventType,
	FunctionRuntime,
	OriginRequestPolicy,
	PriceClass,
	ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { ExtendedStackProps } from "models/stack";
import { WEB_DOMAIN_NAME } from "../../constants";

// /daily gets its own copy of the SPA shell, apps/web's build/dailyEraHtml.ts,
// so a pasted link unfurls as the game. Exported for the test.
export const DAILY_PAGE_FUNCTION_CODE =
	'function handler(event) { var request = event.request; request.uri = "/daily.html"; return request; }';

export interface TeamBuilderWebProps extends ExtendedStackProps {
	// Regional domain name of the production HttpApi (no scheme, no path),
	// e.g. "abc123.execute-api.us-west-2.amazonaws.com". The HttpApi's
	// auto-created $default stage has no path prefix (confirmed reading
	// aws-cdk-lib's createDefaultStage — autoDeploy defaults true), so the
	// CloudFront API origin below is given an empty origin path: /api/foo
	// hits the origin at /api/foo, matching routes exactly as registered.
	apiDomainName: string;
}

// S3 (private, OAC-fronted) + CloudFront for the production nba.yusufaf.dev
// site. Sibling pattern to team-builder-s3.ts. Deploy-gated to production
// only by the caller (team-builder.ts) — this construct assumes
// hostedZoneId/hostedZoneName/webCertificateArn are present and throws if
// they're not, since it should never be instantiated without them.
//
// Deliberately no BucketDeployment here — infra and frontend content deploys
// stay decoupled; syncing dist/ to the bucket and invalidating CloudFront is
// a separate deploy step (see the plan's Phase 8 runbook), not part of
// `cdk deploy`.
export class TeamBuilderWeb extends Construct {
	// Exposed for TeamBuilderDeployRole (CI's push-to-deploy IAM role), which
	// needs to scope its S3/CloudFront permissions to exactly this bucket
	// and distribution.
	readonly bucket: Bucket;
	readonly distribution: Distribution;

	constructor(scope: Construct, id: string, props: TeamBuilderWebProps) {
		super(scope, id);

		const {
			appName = "team-builder",
			deploymentType = "production",
			hostedZoneId,
			hostedZoneName,
			webCertificateArn,
			apiDomainName,
		} = props;

		if (!hostedZoneId || !hostedZoneName || !webCertificateArn) {
			throw new Error(
				"TeamBuilderWeb requires hostedZoneId, hostedZoneName, and webCertificateArn — it should only be instantiated for deploymentType === 'production'.",
			);
		}

		const webBucketNameAndId = `${appName}-${deploymentType}-web`;
		const webBucket = new Bucket(this, webBucketNameAndId, {
			bucketName: webBucketNameAndId,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.RETAIN,
		});
		this.bucket = webBucket;

		// Modern OAC helper (not legacy OAI) — CDK attaches the bucket policy
		// granting CloudFront read access automatically.
		const s3Origin = S3BucketOrigin.withOriginAccessControl(webBucket);

		// Origin path intentionally left empty — see apiDomainName doc above.
		const apiOrigin = new HttpOrigin(apiDomainName);

		// Honours the daily games' Cache-Control (Daily Era and Cap Five share
		// it; its name and comment stay Daily Era's so CloudFront keeps the
		// existing policy rather than replacing it). defaultTtl must be 0
		// (CDK's default is a day) so a response without one is never cached;
		// maxTtl backs up the Lambda's own 1-hour cap. The date is in the path,
		// so nothing else goes in the cache key.
		const dailyEraCachePolicy = new CachePolicy(this, `${appName}-${deploymentType}-daily-era-cache`, {
			cachePolicyName: `${appName}-${deploymentType}-daily-era`,
			comment: "Honours the Daily Era Lambda's Cache-Control (max-age <= 1h); nothing cached without one",
			defaultTtl: Duration.seconds(0),
			minTtl: Duration.seconds(0),
			maxTtl: Duration.hours(1),
			cookieBehavior: CacheCookieBehavior.none(),
			headerBehavior: CacheHeaderBehavior.none(),
			queryStringBehavior: CacheQueryStringBehavior.none(),
			enableAcceptEncodingGzip: true,
			enableAcceptEncodingBrotli: true,
		});

		const dailyPageNameAndId = `${appName}-${deploymentType}-daily-page`;
		const dailyPageFunction = new CloudFrontFunction(this, dailyPageNameAndId, {
			functionName: dailyPageNameAndId,
			code: FunctionCode.fromInline(DAILY_PAGE_FUNCTION_CODE),
			runtime: FunctionRuntime.JS_2_0,
			comment: "Serves /daily from daily.html so link previews get its OG tags",
		});

		const certificateNameAndId = `${appName}-${deploymentType}-web-cert`;
		const certificate = Certificate.fromCertificateArn(
			this,
			certificateNameAndId,
			webCertificateArn,
		);

		const distributionNameAndId = `${appName}-${deploymentType}-distribution`;
		const distribution = new Distribution(this, distributionNameAndId, {
			defaultBehavior: {
				origin: s3Origin,
				viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				cachePolicy: CachePolicy.CACHING_OPTIMIZED,
			},
			additionalBehaviors: {
				// Must stay ahead of /api/*: CloudFront matches behaviors in
				// order. Keeps ALLOW_ALL for the POST guess (CloudFront never
				// caches a POST) and /api/*'s origin request policy. The
				// Lambdas refuse with 400/410, never 403/404: errorResponses
				// below would swap those for index.html and cache it for 300 s.
				"/api/daily/era/*": {
					origin: apiOrigin,
					viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: AllowedMethods.ALLOW_ALL,
					cachePolicy: dailyEraCachePolicy,
					originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
				},
				// The same as /api/daily/era/*, and for the same reasons.
				"/api/daily/cap-five/*": {
					origin: apiOrigin,
					viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: AllowedMethods.ALLOW_ALL,
					cachePolicy: dailyEraCachePolicy,
					originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
				},
				"/api/*": {
					origin: apiOrigin,
					viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: AllowedMethods.ALLOW_ALL,
					cachePolicy: CachePolicy.CACHING_DISABLED,
					// Forwards Authorization, cookies, and query strings, but
					// NOT the viewer's Host header — API Gateway rejects a
					// request whose Host isn't its own execute-api hostname,
					// so ALL_VIEWER here would 403 every /api/* call while
					// the site itself loaded fine.
					originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
				},
				// Exact path: /daily?date=... matches too, since the query isn't
				// part of the match. The browser's URL stays /daily, so the SPA
				// boots on its route. Before the first web deploy with daily.html,
				// S3 answers 403 and errorResponses serve index.html, so either
				// deploy can go first.
				"/daily": {
					origin: s3Origin,
					viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					cachePolicy: CachePolicy.CACHING_OPTIMIZED,
					functionAssociations: [
						{ function: dailyPageFunction, eventType: FunctionEventType.VIEWER_REQUEST },
					],
				},
				// Public team pages. The Lambda returns index.html with OG tags
				// injected, so crawlers unfurl a published team; the browser
				// then boots the SPA from that same shell. Uncached at the edge
				// because the body varies per team.
				"/t/*": {
					origin: apiOrigin,
					viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
					cachePolicy: CachePolicy.CACHING_DISABLED,
					originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
				},
			},
			domainNames: [WEB_DOMAIN_NAME],
			certificate,
			defaultRootObject: "index.html",
			// A fully private OAC bucket returns 403 for missing keys too,
			// not just truly-forbidden objects — mapping both 403 and 404 to
			// index.html covers it. Needed for vue-router's
			// createWebHistory since there's no server-side rewrite.
			errorResponses: [
				{
					httpStatus: 403,
					responseHttpStatus: 200,
					responsePagePath: "/index.html",
				},
				{
					httpStatus: 404,
					responseHttpStatus: 200,
					responsePagePath: "/index.html",
				},
			],
			// Cost-appropriate for a personal-project audience — easy to
			// change later.
			priceClass: PriceClass.PRICE_CLASS_100,
		});
		this.distribution = distribution;

		const hostedZoneNameAndId = `${appName}-${deploymentType}-web-hosted-zone`;
		const hostedZone = HostedZone.fromHostedZoneAttributes(
			this,
			hostedZoneNameAndId,
			{
				hostedZoneId,
				zoneName: hostedZoneName,
			},
		);

		const aliasTarget = RecordTarget.fromAlias(
			new CloudFrontTarget(distribution),
		);

		// If the hosted zone IS nba.yusufaf.dev (a delegated subzone), the
		// record is the zone apex and recordName must be left undefined —
		// passing "nba" here would create nba.nba.yusufaf.dev. If the zone
		// is a parent (e.g. the full yusufaf.dev zone), recordName is the
		// "nba" label stripped off WEB_DOMAIN_NAME.
		const recordName =
			hostedZoneName === WEB_DOMAIN_NAME
				? undefined
				: WEB_DOMAIN_NAME.slice(0, -(hostedZoneName.length + 1));

		new ARecord(this, `${appName}-${deploymentType}-web-a-record`, {
			zone: hostedZone,
			recordName,
			target: aliasTarget,
		});

		new AaaaRecord(this, `${appName}-${deploymentType}-web-aaaa-record`, {
			zone: hostedZone,
			recordName,
			target: aliasTarget,
		});
	}
}
