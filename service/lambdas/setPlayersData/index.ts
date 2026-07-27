import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { BBREF_BASE_URL } from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "setPlayersData";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1024,
		timeout: Duration.minutes(5),
		environment: {
			BBREF_BASE_URL,
			staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
		},
		layers: ["node-fetch_cheerio"],
		schedule: {
			enabled: true,
			description:
				"Weekly refresh of the players.json static data file (all-time NBA players from Basketball-Reference)",
			rate: Duration.days(7),
		},
	});

	return lambdaFunction;
};
