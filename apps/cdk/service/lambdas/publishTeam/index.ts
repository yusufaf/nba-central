import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "publishTeam";

	// Set by team-builder.ts from the assets CloudFront distribution; an
	// empty value would produce "https:///cards/…", so fail synth loudly
	// instead of shipping a broken cardUrl.
	if (!props.assetsCdnDomain) {
		throw new Error(
			"publishTeam requires assetsCdnDomain (set by TeamBuilder from TeamBuilderAssetsCdn)",
		);
	}

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1000,
		timeout: Duration.seconds(30),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
			assetsCdnDomain: props.assetsCdnDomain,
		},
	});

	return lambdaFunction;
};
