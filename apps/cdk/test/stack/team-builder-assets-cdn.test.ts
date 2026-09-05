import { describe, it, expect } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { TeamBuilderAssetsCdn } from "../../service/team-builder-stack/team-builder-assets-cdn";

// Isolated-construct pattern, as in team-builder-web.test.ts: a plain private
// bucket stands in for TeamBuilderS3's real assets bucket.
const buildTemplate = () => {
    const app = new App();
    const stack = new Stack(app, "test-stack", {
        env: { account: "123456789012", region: "us-west-2" },
    });
    const assetsBucket = new Bucket(stack, "assets", {
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
    new TeamBuilderAssetsCdn(stack, "assets-cdn", {
        appName: "team-builder",
        deploymentType: "test",
        assetsBucket,
    });
    return Template.fromStack(stack);
};

const getDistributionConfig = (template: Template) => {
    const distributions = template.findResources("AWS::CloudFront::Distribution");
    return Object.values(distributions)[0].Properties.DistributionConfig;
};

describe("TeamBuilderAssetsCdn", () => {
    it("creates exactly one CloudFront distribution and no new bucket", () => {
        const template = buildTemplate();
        template.resourceCountIs("AWS::CloudFront::Distribution", 1);
        template.resourceCountIs("AWS::S3::Bucket", 1);
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

    it("has no custom domain or aliases — the default cloudfront.net name is used", () => {
        const template = buildTemplate();
        const distConfig = getDistributionConfig(template);
        expect(distConfig.Aliases).toBeUndefined();
        expect(distConfig.ViewerCertificate?.AcmCertificateArn).toBeUndefined();
    });

    it("redirects HTTP to HTTPS on the default behavior", () => {
        const template = buildTemplate();
        const distConfig = getDistributionConfig(template);
        expect(distConfig.DefaultCacheBehavior.ViewerProtocolPolicy).toBe(
            "redirect-to-https",
        );
    });
});
