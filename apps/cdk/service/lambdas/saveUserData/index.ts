import { LambdaProps } from "../../../models/stack";
import { Duration } from "aws-cdk-lib";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "saveUserData";
	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			environment: {
				USERS_TABLE_NAME: `${props.appName}-${props.deploymentType}-users`,
			},
			timeout: Duration.seconds(30),
			memorySize: 1024,
		},
	);

	return lambdaFunction;
};
