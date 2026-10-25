import { describe, it } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import setSeasonContextData from "../../service/lambdas/setSeasonContextData";

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
});
