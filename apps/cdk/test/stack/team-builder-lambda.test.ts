import { describe, it, expect } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { TeamBuilderLambda } from "../../service/constructs/TeamBuilderLambda";
import { TeamBuilderAlerts } from "../../service/team-builder-stack/team-builder-alerts";
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
	const alerts = new TeamBuilderAlerts(stack, "Alerts", {
		appName: "team-builder",
		deploymentType: "development",
		email: "a@b.test",
	});
	new TeamBuilderLambda(stack, "Fn", {
		functionName: "fetchNewsCron",
		stackProps: { appName: "team-builder", deploymentType: "development", alerts },
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

	it("doesn't alarm or route failures for an unmonitored Lambda", () => {
		const template = build();
		template.resourceCountIs("AWS::CloudWatch::Alarm", 0);
		template.resourceCountIs("AWS::Lambda::EventInvokeConfig", 0);
	});

	it("alarms the alerts topic on the first error by default", () => {
		build({ monitor: {} }).hasResourceProperties("AWS::CloudWatch::Alarm", {
			AlarmName: "team-builder-development-fetchNewsCron-errors",
			MetricName: "Errors",
			Namespace: "AWS/Lambda",
			Statistic: "Sum",
			Period: 300,
			EvaluationPeriods: 24,
			DatapointsToAlarm: 1,
			Threshold: 1,
			ComparisonOperator: "GreaterThanOrEqualToThreshold",
			TreatMissingData: "notBreaching",
			AlarmActions: [{ Ref: Match.stringLikeRegexp("AlertsTopic") }],
			OKActions: Match.absent(),
		});
	});

	it("raises the bar with failuresToAlarm", () => {
		build({ monitor: { failuresToAlarm: 3 } }).hasResourceProperties(
			"AWS::CloudWatch::Alarm",
			{ DatapointsToAlarm: 3 },
		);
	});

	it("sends events that fail every retry to the failed-events queue, keeping retryAttempts", () => {
		const template = build({ monitor: {}, functionProps: { retryAttempts: 0 } });
		template.resourceCountIs("AWS::Lambda::EventInvokeConfig", 1);
		template.hasResourceProperties("AWS::Lambda::EventInvokeConfig", {
			MaximumRetryAttempts: 0,
			DestinationConfig: {
				OnFailure: {
					Destination: {
						"Fn::GetAtt": [Match.stringLikeRegexp("FailedEvents"), "Arn"],
					},
				},
			},
		});
	});

	// The guard runs before the role lookup, so this needs no registry.
	it("refuses monitor without stackProps.alerts", () => {
		expect(
			() =>
				new TeamBuilderLambda(newStack("s2"), "Fn2", {
					functionName: "fetchNewsCron",
					stackProps: { appName: "team-builder", deploymentType: "development" },
					monitor: {},
				}),
		).toThrow("monitor needs stackProps.alerts");
	});
});
