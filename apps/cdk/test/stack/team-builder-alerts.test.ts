import { describe, it } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { TeamBuilderAlerts } from "../../service/team-builder-stack/team-builder-alerts";
import { ALERTS_TO_ADDRESS } from "../../constants";

const buildTemplate = () => {
    const stack = new Stack(new App(), "s");
    new TeamBuilderAlerts(stack, "Alerts", {
        appName: "team-builder",
        deploymentType: "development",
        email: ALERTS_TO_ADDRESS,
    });
    return Template.fromStack(stack);
};

describe("TeamBuilderAlerts", () => {
    it("emails the owner through a single topic", () => {
        const template = buildTemplate();
        template.resourceCountIs("AWS::SNS::Topic", 1);
        template.hasResourceProperties("AWS::SNS::Topic", {
            TopicName: "team-builder-development-alerts",
        });
        template.hasResourceProperties("AWS::SNS::Subscription", {
            Protocol: "email",
            Endpoint: ALERTS_TO_ADDRESS,
        });
    });

    it("keeps failed events for 14 days", () => {
        buildTemplate().hasResourceProperties("AWS::SQS::Queue", {
            QueueName: "team-builder-development-failed-events",
            MessageRetentionPeriod: 1209600,
        });
    });
});
