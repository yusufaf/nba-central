import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "uploadArenaImage";

	// An empty domain would store "https:///arenas/…" URLs.
	if (!props.assetsCdnDomain) {
		throw new Error(
			"uploadArenaImage requires assetsCdnDomain (set by TeamBuilder from TeamBuilderAssetsCdn)",
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
			assetsCdnDomain: props.assetsCdnDomain,
		},
	});

	return lambdaFunction;
};
