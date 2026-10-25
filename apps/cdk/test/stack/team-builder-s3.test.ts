import { describe, it, expect } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { TeamBuilderS3 } from "../../service/team-builder-stack/team-builder-s3";

const buildTemplate = () => {
    const app = new App();
    const stack = new Stack(app, "test-stack", {
        env: { account: "123456789012", region: "us-west-2" },
    });
    new TeamBuilderS3(stack, "s3", { appName: "team-builder", deploymentType: "test" });
    return Template.fromStack(stack);
};

describe("TeamBuilderS3", () => {
    it("expires old versions of the assets bucket's live/ files after 7 days", () => {
        const buckets = buildTemplate().findResources("AWS::S3::Bucket");
        const byName = Object.fromEntries(
            Object.values(buckets).map((b: any) => [b.Properties.BucketName, b.Properties]),
        );
        expect(byName["team-builder-test-assets"].LifecycleConfiguration.Rules).toEqual([
            {
                Id: "expire-old-live-versions",
                Prefix: "live/",
                NoncurrentVersionExpiration: { NoncurrentDays: 7 },
                Status: "Enabled",
            },
        ]);
        expect(byName["team-builder-test-static-data"].LifecycleConfiguration).toBeUndefined();
    });
});
