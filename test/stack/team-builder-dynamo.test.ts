import { describe, it, expect } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { TeamBuilderDynamoDB } from "../../service/team-builder-stack/team-builder-dynamo";

// Construct-level CDK assertion test. Uses TeamBuilderDynamoDB in isolation so
// no Lambda esbuild bundling runs (fast + deterministic). Establishes the
// pattern for asserting on synthesized CloudFormation.
const buildTemplate = () => {
    const app = new App();
    const stack = new Stack(app, "test-stack", {
        env: { account: "123456789012", region: "us-west-2" },
    });
    new TeamBuilderDynamoDB(stack, "dynamo", {
        env: { account: "123456789012", region: "us-west-2" },
        appName: "team-builder",
        deploymentType: "test",
    });
    return Template.fromStack(stack);
};

describe("TeamBuilderDynamoDB", () => {
    it("creates exactly 2 DynamoDB tables", () => {
        buildTemplate().resourceCountIs("AWS::DynamoDB::Table", 2);
    });

    it("names tables with appName-deploymentType prefix", () => {
        const template = buildTemplate();
        template.hasResourceProperties("AWS::DynamoDB::Table", {
            TableName: "team-builder-test-main",
        });
        template.hasResourceProperties("AWS::DynamoDB::Table", {
            TableName: "team-builder-test-users",
        });
    });

    it("uses on-demand billing with PITR and TTL", () => {
        const template = buildTemplate();
        template.hasResourceProperties("AWS::DynamoDB::Table", {
            BillingMode: "PAY_PER_REQUEST",
            PointInTimeRecoverySpecification: {
                PointInTimeRecoveryEnabled: true,
            },
            TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
        });
    });

    it("adds 2 GSIs per table", () => {
        const template = buildTemplate();
        const tables = template.findResources("AWS::DynamoDB::Table");
        for (const table of Object.values(tables)) {
            expect(table.Properties.GlobalSecondaryIndexes).toHaveLength(2);
        }
    });
});
