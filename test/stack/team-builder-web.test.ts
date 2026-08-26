import { describe, it, expect } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { TeamBuilderWeb } from "../../service/team-builder-stack/team-builder-web";

// Construct-level CDK assertion test, following the isolated-construct
// pattern in test/stack/team-builder-dynamo.test.ts (dummy account/region,
// Template.fromStack, no real AWS calls).
const TEST_CERT_ARN =
	"arn:aws:acm:us-east-1:123456789012:certificate/test-web-cert";
const TEST_API_DOMAIN = "abc123.execute-api.us-west-2.amazonaws.com";

const buildTemplate = (hostedZoneName = "yusufaf.dev") => {
	const app = new App();
	const stack = new Stack(app, "test-stack", {
		env: { account: "123456789012", region: "us-west-2" },
	});
	new TeamBuilderWeb(stack, "web", {
		env: { account: "123456789012", region: "us-west-2" },
		appName: "team-builder",
		deploymentType: "test",
		hostedZoneId: "Z1234567890ABC",
		hostedZoneName,
		webCertificateArn: TEST_CERT_ARN,
		apiDomainName: TEST_API_DOMAIN,
	});
	return Template.fromStack(stack);
};

const getDistributionConfig = (template: Template) => {
	const distributions = template.findResources(
		"AWS::CloudFront::Distribution",
	);
	return Object.values(distributions)[0].Properties.DistributionConfig;
};

describe("TeamBuilderWeb", () => {
	it("creates exactly one CloudFront distribution and one S3 bucket", () => {
		const template = buildTemplate();
		template.resourceCountIs("AWS::CloudFront::Distribution", 1);
		template.resourceCountIs("AWS::S3::Bucket", 1);
	});

	it("blocks all public access on the web bucket", () => {
		const template = buildTemplate();
		template.hasResourceProperties("AWS::S3::Bucket", {
			PublicAccessBlockConfiguration: {
				BlockPublicAcls: true,
				BlockPublicPolicy: true,
				IgnorePublicAcls: true,
				RestrictPublicBuckets: true,
			},
		});
	});

	it("uses an OriginAccessControl (not a legacy OAI) for the S3 origin", () => {
		const template = buildTemplate();
		template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
		template.resourceCountIs(
			"AWS::CloudFront::CloudFrontOriginAccessIdentity",
			0,
		);

		const distConfig = getDistributionConfig(template);
		const s3Origin = distConfig.Origins.find(
			(origin: any) => origin.OriginAccessControlId,
		);
		expect(s3Origin).toBeDefined();
		expect(s3Origin.S3OriginConfig).toBeDefined();
	});

	it("maps both 403 and 404 to /index.html with a 200 response", () => {
		const template = buildTemplate();
		const distConfig = getDistributionConfig(template);
		const errorResponses = distConfig.CustomErrorResponses;

		expect(errorResponses).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					ErrorCode: 403,
					ResponseCode: 200,
					ResponsePagePath: "/index.html",
				}),
				expect.objectContaining({
					ErrorCode: 404,
					ResponseCode: 200,
					ResponsePagePath: "/index.html",
				}),
			]),
		);
	});

	it("routes /api/* to a distinct non-S3 origin", () => {
		const template = buildTemplate();
		const distConfig = getDistributionConfig(template);

		const apiBehavior = distConfig.CacheBehaviors.find(
			(behavior: any) => behavior.PathPattern === "/api/*",
		);
		expect(apiBehavior).toBeDefined();

		const apiOrigin = distConfig.Origins.find(
			(origin: any) => origin.Id === apiBehavior.TargetOriginId,
		);
		expect(apiOrigin).toBeDefined();
		expect(apiOrigin.S3OriginConfig).toBeUndefined();
		expect(apiOrigin.CustomOriginConfig).toBeDefined();
		expect(apiOrigin.DomainName).toBe(TEST_API_DOMAIN);
	});

	it("serves nba.yusufaf.dev with the production web certificate", () => {
		const template = buildTemplate();
		const distConfig = getDistributionConfig(template);

		expect(distConfig.Aliases).toContain("nba.yusufaf.dev");
		expect(distConfig.ViewerCertificate.AcmCertificateArn).toBe(
			TEST_CERT_ARN,
		);
	});

	it("forwards viewer headers to the API origin except Host", () => {
		const template = buildTemplate();
		const distConfig = getDistributionConfig(template);

		const apiBehavior = distConfig.CacheBehaviors.find(
			(behavior: any) => behavior.PathPattern === "/api/*",
		);
		// ALL_VIEWER_EXCEPT_HOST_HEADER's managed policy id — API Gateway
		// rejects a request whose Host header isn't its own execute-api
		// hostname, so forwarding it (ALL_VIEWER) would 403 every API call.
		expect(apiBehavior.OriginRequestPolicyId).toBe(
			"b689b0a8-53d0-40ab-baf2-68738e2966ac",
		);
	});

	it("records the alias at the zone apex when the hosted zone IS the web domain (delegated subzone)", () => {
		const template = buildTemplate("nba.yusufaf.dev");

		const aRecords = template.findResources("AWS::Route53::RecordSet", {
			Properties: { Type: "A" },
		});
		const names = Object.values(aRecords).map(
			(record: any) => record.Properties.Name,
		);
		expect(names).toEqual(["nba.yusufaf.dev."]);
	});

	it("records the alias under the 'nba' label when the hosted zone is a parent domain", () => {
		const template = buildTemplate("yusufaf.dev");

		const aRecords = template.findResources("AWS::Route53::RecordSet", {
			Properties: { Type: "A" },
		});
		const names = Object.values(aRecords).map(
			(record: any) => record.Properties.Name,
		);
		expect(names).toEqual(["nba.yusufaf.dev."]);
	});

	it("throws if instantiated without production wiring props", () => {
		const app = new App();
		const stack = new Stack(app, "test-stack-missing-props", {
			env: { account: "123456789012", region: "us-west-2" },
		});

		expect(
			() =>
				new TeamBuilderWeb(stack, "web", {
					env: { account: "123456789012", region: "us-west-2" },
					appName: "team-builder",
					deploymentType: "test",
					apiDomainName: TEST_API_DOMAIN,
				}),
		).toThrow();
	});
});
