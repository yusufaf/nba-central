import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { LOGTO_API_RESOURCE, LOGTO_ENDPOINT } from "../../../resources/logto";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "apiAuthorizer";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1000,
		timeout: Duration.seconds(30),
		environment: {
			logtoEndpoint: LOGTO_ENDPOINT[props.deploymentType || ""],
			apiResource: LOGTO_API_RESOURCE[props.deploymentType || ""],
		},
	});

	return lambdaFunction;
};
