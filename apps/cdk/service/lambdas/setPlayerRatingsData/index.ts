import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { NBA2K_API_BASE_URL } from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "setPlayerRatingsData";
	// No node-fetch layer here - the source is JSON, so there's nothing to
	// parse with cheerio and the Node 22 runtime's global fetch is enough.
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1024,
		timeout: Duration.minutes(5),
		environment: {
			NBA2K_API_BASE_URL,
			staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
		},
		schedule: {
			enabled: true,
			description:
				"Weekly refresh of the player-ratings.json static data file (NBA 2K overall ratings joined onto the Basketball-Reference player pool)",
			rate: Duration.days(7),
		},
	});

	return lambdaFunction;
};
