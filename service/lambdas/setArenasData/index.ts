import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "setArenasData";
	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			memorySize: 1000,
			timeout: Duration.seconds(30),
			environment: {
				staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
			},
			layers: ["node-fetch_cheerio"],
			schedule: {
				enabled: true,
				description:
					"Regular update to the arenas.json static data file",
				rate: Duration.days(365),
			},
		},
	);

	return lambdaFunction;
};
