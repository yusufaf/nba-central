import { describe, it } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import setPlayerStatsData from "../../service/lambdas/setPlayerStatsData";

describe("setPlayerStatsData", () => {
	// A development copy would scrape BBRef in production's slots. The
	// construct returns before creating anything, so this needs no registry.
	it("is production-only", () => {
		const stack = new Stack(new App(), "test-stack");
		setPlayerStatsData({
			construct: stack,
			props: { appName: "team-builder", deploymentType: "development" },
		});
		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Lambda::Function", 0);
		template.resourceCountIs("AWS::Events::Rule", 0);
	});
});
