import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getDailyEra";

	// An empty domain would serve "https:///daily-era/…" as the image URL.
	if (!props.assetsCdnDomain) {
		throw new Error(
			"getDailyEra requires assetsCdnDomain (set by TeamBuilder from TeamBuilderAssetsCdn)",
		);
	}

	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(10),
		environment: {
			staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
			assetsCdnDomain: props.assetsCdnDomain,
		},
	});

	return lambdaFunction;
};
