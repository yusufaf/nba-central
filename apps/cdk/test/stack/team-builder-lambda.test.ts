import { describe, it } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { TeamBuilderLambda } from "../../service/constructs/TeamBuilderLambda";
import { addRole } from "../../resources/roles";

type Config = ConstructorParameters<typeof TeamBuilderLambda>[2];

// An empty bundling-stacks list skips esbuild, so this synths no Lambda code.
const newStack = (id = "s") =>
	new Stack(new App({ context: { "aws:cdk:bundling-stacks": [] } }), id);

const build = (config: Partial<Config> = {}) => {
	const stack = newStack();
	addRole(
		"team-builder-development-main-lambda-role",
		new Role(stack, "Role", { assumedBy: new ServicePrincipal("lambda.amazonaws.com") }),
		true,
	);
	new TeamBuilderLambda(stack, "Fn", {
		functionName: "fetchNewsCron",
		stackProps: { appName: "team-builder", deploymentType: "development" },
		...config,
	});
	return Template.fromStack(stack);
};

describe("TeamBuilderLambda", () => {
	it("gives every Lambda its own log group with 30-day retention", () => {
		const template = build();
		template.hasResource("AWS::Logs::LogGroup", {
			Properties: { RetentionInDays: 30 },
			DeletionPolicy: "Delete",
		});
		template.hasResourceProperties("AWS::Lambda::Function", {
			LoggingConfig: { LogGroup: { Ref: Match.anyValue() } },
		});
	});
});
