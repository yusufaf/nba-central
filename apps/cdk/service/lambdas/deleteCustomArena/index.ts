import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "deleteCustomArena";

	// Without it the deleted images stay cached at the CDN.
	if (!props.assetsDistributionId) {
		throw new Error(
			"deleteCustomArena requires assetsDistributionId (set by TeamBuilder from TeamBuilderAssetsCdn)",
		);
	}

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(30),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
			assetsDistributionId: props.assetsDistributionId,
		},
	});

	return lambdaFunction;
};
