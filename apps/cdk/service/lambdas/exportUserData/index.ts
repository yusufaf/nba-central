import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "exportUserData";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		// The whole partition is held in memory and serialised once.
		memorySize: 1024,
		timeout: Duration.seconds(30),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			usersTable: `${props.appName}-${props.deploymentType}-users`,
		},
	});

	return lambdaFunction;
};
