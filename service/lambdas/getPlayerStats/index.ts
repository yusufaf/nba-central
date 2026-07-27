import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { BBREF_BASE_URL } from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getPlayerStats";
	const {
		appName = "team-builder",
		deploymentType = "development",
	} = props;
	const mainTableName = `${appName}-${deploymentType}-main`;

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(30),
		environment: {
			BBREF_BASE_URL,
			MAIN_TABLE_NAME: mainTableName,
			staticDataBucket: `${appName}-${deploymentType}-static-data`,
		},
		layers: ["node-fetch_cheerio"],
	});

	return lambdaFunction;
};
