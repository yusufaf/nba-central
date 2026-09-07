import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import {
	FEEDBACK_SES_REGION,
	FEEDBACK_FROM_ADDRESS,
	FEEDBACK_TO_ADDRESS,
} from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "sendFeedback";
	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			memorySize: 1000,
			timeout: Duration.seconds(30),
			environment: {
				FEEDBACK_SES_REGION,
				FEEDBACK_FROM_ADDRESS,
				FEEDBACK_TO_ADDRESS,
			},
		},
	);

	return lambdaFunction;
};
