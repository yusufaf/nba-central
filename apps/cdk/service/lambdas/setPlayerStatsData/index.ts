import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { BBREF_BASE_URL } from "../../../constants";
// Relative, not "utilities/player-stats": cdk.json runs `npx ts-node` with no
// tsconfig-paths, and every wrapper imports with relative paths. Only
// esbuild-bundled handlers use the alias.
import { SNAPSHOT_INTERVAL_MINUTES } from "../../../utilities/player-stats";

// Under the interval, so a run is always over before the next one starts.
export const SNAPSHOT_TIMEOUT = Duration.minutes(13);

export default ({ props, construct }: LambdaProps) => {
	const functionName = "setPlayerStatsData";
	const {
		appName = "team-builder",
		deploymentType = "development",
	} = props;

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		monitor: {},
		memorySize: 1024,
		timeout: SNAPSHOT_TIMEOUT,
		// A development copy would run in the same :00/:20/:40 slots as
		// production's, against BBRef's 20 requests a minute.
		deployToTypes: ["production"],
		environment: {
			BBREF_BASE_URL,
			MAIN_TABLE_NAME: `${appName}-${deploymentType}-main`,
			staticDataBucket: `${appName}-${deploymentType}-static-data`,
		},
		layers: ["node-fetch_cheerio"],
		// Same as setPlayersData: a retry would re-hit BBRef right after it
		// refused us.
		functionProps: { retryAttempts: 0 },
		schedule: {
			enabled: true,
			description:
				"Every 20 minutes: scrapes the Basketball-Reference careers that are due into the player stats snapshot (main table, PK PLAYERSTATS)",
			cron: { minute: `0/${SNAPSHOT_INTERVAL_MINUTES}` },
		},
	});

	return lambdaFunction;
};
