import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "guessDailyEra";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(10),
		environment: {
			staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
		},
	});

	return lambdaFunction;
};
