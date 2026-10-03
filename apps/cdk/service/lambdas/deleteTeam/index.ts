import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "deleteTeam";

	// The team's share cards are deleted with it, and their CDN copies
	// invalidated.
	if (!props.assetsDistributionId) {
		throw new Error(
			"deleteTeam requires assetsDistributionId (set by TeamBuilder from TeamBuilderAssetsCdn)",
		);
	}

	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			memorySize: 512,
			timeout: Duration.seconds(30),
			environment: {
				mainTable: `${props.appName}-${props.deploymentType}-main`,
				assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
				assetsDistributionId: props.assetsDistributionId,
			},
		},
	);

	return lambdaFunction;
};
