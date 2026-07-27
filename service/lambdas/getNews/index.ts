import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getNews";
	const {
		appName = "team-builder",
		deploymentType = "development",
	} = props;
	const mainTableName = `${appName}-${deploymentType}-main`;

	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			memorySize: 512,
			timeout: Duration.seconds(30),
			environment: {
				MAIN_TABLE_NAME: mainTableName,
			},
		},
	);

	return lambdaFunction;
};
