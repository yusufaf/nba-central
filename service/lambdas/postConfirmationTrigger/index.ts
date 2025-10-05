import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "postConfirmationTrigger";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1000,
		timeout: Duration.seconds(30),
		environment: {
			usersTable: `${props.appName}-${props.deploymentType}-users`,
		},
	});

	return lambdaFunction;
};
