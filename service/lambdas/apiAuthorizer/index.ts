import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import {
	USER_POOL_CLIENT_IDS,
	USER_POOL_IDS,
} from "../../../resources/cognito";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "apiAuthorizer";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1000,
		timeout: Duration.seconds(30),
		environment: {
			userPoolId: USER_POOL_IDS[props.deploymentType || ""],
			clientId: USER_POOL_CLIENT_IDS[props.deploymentType || ""],
		},
	});

	return lambdaFunction;
};
