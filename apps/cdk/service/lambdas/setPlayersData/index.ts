import { Duration } from "aws-cdk-lib";
import { CronOptions } from "aws-cdk-lib/aws-events";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { BBREF_BASE_URL } from "../../../constants";

// Fixed slot, not a rate: setPlayerStatsData makes no request past
// SNAPSHOT_STOP_AFTER_MINUTES into its :00/:20/:40 slot, so this run starts in
// the gap after 10:12 and is done before 10:20. Two scrapers at once would
// break BBRef's 20 requests a minute.
export const PLAYERS_DATA_CRON: CronOptions = { weekDay: "MON", hour: "10", minute: "14" };
export const PLAYERS_DATA_TIMEOUT = Duration.minutes(5);

export default ({ props, construct }: LambdaProps) => {
	const functionName = "setPlayersData";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		monitor: {},
		memorySize: 1024,
		timeout: PLAYERS_DATA_TIMEOUT,
		environment: {
			BBREF_BASE_URL,
			staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
			// For live/team-seasons/current.json, read alongside live/headshots.json.
			assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
		},
		layers: ["node-fetch_cheerio"],
		// A failed run throws now; Lambda's default 2 async retries would
		// re-hit BBRef 26 times each, minutes after it blocked us.
		functionProps: { retryAttempts: 0 },
		schedule: {
			enabled: true,
			description:
				"Weekly refresh of the players.json static data file (all-time NBA players from Basketball-Reference)",
			cron: PLAYERS_DATA_CRON,
		},
	});

	return lambdaFunction;
};
