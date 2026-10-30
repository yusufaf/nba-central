import { describe, it } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Function } from "aws-cdk-lib/aws-lambda";
import setSeasonContextData, {
	addInjuriesSchedule,
} from "../../service/lambdas/setSeasonContextData";

describe("setSeasonContextData", () => {
	// The web reads only the production CDN. The construct returns before
	// creating anything (or bundling), so this needs no role registry.
	it("is production-only", () => {
		const stack = new Stack(new App(), "test-stack");
		setSeasonContextData({
			construct: stack,
			props: { appName: "team-builder", deploymentType: "development" },
		});
		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Lambda::Function", 0);
		template.resourceCountIs("AWS::Events::Rule", 0);
	});

	// The handler takes the injuries path only for this exact input (its
	// INJURIES_DATASET, pinned by the Lambda test's { dataset: "injuries" }).
	it("sends the injuries rule its dataset every 15 minutes", () => {
		const stack = new Stack(new App(), "test-stack");
		const fn = Function.fromFunctionArn(stack, "Fn", "arn:aws:lambda:us-west-2:123456789012:function:f");
		addInjuriesSchedule(stack, fn, { appName: "team-builder", deploymentType: "production" });
		Template.fromStack(stack).hasResourceProperties("AWS::Events::Rule", {
			Name: "team-builder-production-setSeasonContextData-injuries-schedule",
			ScheduleExpression: "cron(2/15 * * * ? *)",
			Targets: Match.arrayWith([Match.objectLike({ Input: JSON.stringify({ dataset: "injuries" }) })]),
		});
	});
});
