import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { ESPN_TEAMS_URL } from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getTeamLogos";
	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			memorySize: 1000,
			timeout: Duration.seconds(30),
			environment: {
				ESPN_TEAMS_URL,
			},
		},
	);

	return lambdaFunction;
};
