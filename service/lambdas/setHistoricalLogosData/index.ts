import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "setHistoricalLogosData";
	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			memorySize: 1024,
			timeout: Duration.minutes(5), 
			environment: {
				staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
			},
			layers: ["node-fetch_cheerio"],
			schedule: {
				enabled: true,
				description:
					"Regular update to the historical-logos.json static data file",
				rate: Duration.days(30), // Monthly update since logos don't change often
			},
		},
	);

	return lambdaFunction;
};
