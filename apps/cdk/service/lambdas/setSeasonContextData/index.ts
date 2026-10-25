import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import {
	ESPN_API_BASE_URL,
	ESPN_HEADSHOT_BASE_URL,
	ESPN_STANDINGS_URL,
} from "../../../constants";

export const SEASON_CONTEXT_CRON = { minute: "7" };
export const SEASON_CONTEXT_TIMEOUT = Duration.minutes(5);

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

	return lambdaFunction;
};
