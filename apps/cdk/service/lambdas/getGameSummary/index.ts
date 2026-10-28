import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { ESPN_API_BASE_URL } from "../../../constants";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getGameSummary";

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(10),
		environment: { ESPN_API_BASE_URL },
	});

	return lambdaFunction;
};
