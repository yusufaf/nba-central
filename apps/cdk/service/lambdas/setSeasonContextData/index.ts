import { Duration } from "aws-cdk-lib";
import { Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { ExtendedStackProps, LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda, toSchedule } from "../../constructs/TeamBuilderLambda";
import {
	ESPN_API_BASE_URL,
	ESPN_HEADSHOT_BASE_URL,
	ESPN_INJURIES_URL,
	ESPN_STANDINGS_URL,
} from "../../../constants";

export const SEASON_CONTEXT_CRON = { minute: "7" };
export const SEASON_CONTEXT_TIMEOUT = Duration.minutes(5);
// :02, :17, :32 and :47, so it never overlaps the hourly :07 run.
export const INJURIES_CRON = { minute: "2/15" };

// The handler's INJURIES_DATASET; this file can't import the Lambda source,
// so the stack and Lambda tests pin both sides.
const INJURIES_EVENT = { dataset: "injuries" };

// TeamBuilderLambda takes one schedule, so the second rule is added here.
export const addInjuriesSchedule = (
	scope: Construct,
	fn: IFunction,
	{ appName = "team-builder", deploymentType = "development" }: ExtendedStackProps,
) =>
	new Rule(scope, "setSeasonContextData-injuries-rule", {
		ruleName: `${appName}-${deploymentType}-setSeasonContextData-injuries-schedule`,
		description: "Every 15 minutes: ESPN injuries joined to BBRef ids into live/injuries.json",
		schedule: toSchedule({ cron: INJURIES_CRON }),
		targets: [new LambdaFunction(fn, { event: RuleTargetInput.fromObject(INJURIES_EVENT) })],
	});

export default ({ props, construct }: LambdaProps) => {
	const functionName = "setSeasonContextData";
	const {
		appName = "team-builder",
		deploymentType = "development",
	} = props;

	// No layers: the sources are JSON and PNG, so global fetch is enough.
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: SEASON_CONTEXT_TIMEOUT,
		// The web reads only the production CDN, so a development copy would
		// double the ESPN traffic for files nothing reads.
		deployToTypes: ["production"],
		environment: {
			ESPN_API_BASE_URL,
			ESPN_STANDINGS_URL,
			ESPN_HEADSHOT_BASE_URL,
			ESPN_INJURIES_URL,
			assetsBucket: `${appName}-${deploymentType}-assets`,
			staticDataBucket: `${appName}-${deploymentType}-static-data`,
		},
		// A retry would re-hit ESPN; the next hourly run picks up anyway.
		functionProps: { retryAttempts: 0 },
		schedule: {
			enabled: true,
			description:
				"Hourly: ESPN standings and a week of schedule (rosters daily, headshots in batches) into live/ in the assets bucket",
			cron: SEASON_CONTEXT_CRON,
		},
	});

	// Unset when this deployment type is excluded.
	if (lambdaFunction) addInjuriesSchedule(construct, lambdaFunction, props);

	return lambdaFunction;
};
