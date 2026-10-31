import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getPlayers";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(30),
		environment: {
			staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
			// live/headshots.json (each player's current team) is written only by
			// the production-only setSeasonContextData, so other stacks skip the read.
			...(props.deploymentType === "production"
				? { assetsBucket: `${props.appName}-${props.deploymentType}-assets` }
				: {}),
		},
	});

	return lambdaFunction;
};
