import { describe, it } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { throttleDefaultStage } from "../../service/team-builder-stack/api-throttle";

describe("throttleDefaultStage", () => {
	it("gives every route on $default a 50 rps / 100 burst limit", () => {
		const stack = new Stack(new App(), "s");
		throttleDefaultStage(new HttpApi(stack, "Api"));

		Template.fromStack(stack).hasResourceProperties("AWS::ApiGatewayV2::Stage", {
			StageName: "$default",
			DefaultRouteSettings: { ThrottlingRateLimit: 50, ThrottlingBurstLimit: 100 },
		});
	});
});
