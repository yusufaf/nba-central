import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "uploadAvatar";

	// Same as publishTeam: an empty domain would store "https:///avatars/…".
	if (!props.assetsCdnDomain) {
		throw new Error(
			"uploadAvatar requires assetsCdnDomain (set by TeamBuilder from TeamBuilderAssetsCdn)",
		);
	}

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(30),
		environment: {
			usersTable: `${props.appName}-${props.deploymentType}-users`,
			assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
			assetsCdnDomain: props.assetsCdnDomain,
		},
	});

	return lambdaFunction;
};
