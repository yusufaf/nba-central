import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "deleteUserData";

	// Without it the deleted cards and avatar stay cached at the CDN.
	if (!props.assetsDistributionId) {
		throw new Error(
			"deleteUserData requires assetsDistributionId (set by TeamBuilder from TeamBuilderAssetsCdn)",
		);
	}

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		// API Gateway gives up after 30 seconds; the delete keeps going past
		// that so a large account still finishes, and a retry is a no-op.
		timeout: Duration.minutes(2),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			usersTable: `${props.appName}-${props.deploymentType}-users`,
			assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
			assetsDistributionId: props.assetsDistributionId,
		},
	});

	return lambdaFunction;
};
