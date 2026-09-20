import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "publishTeam";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1000,
		timeout: Duration.seconds(30),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
			// Set by team-builder.ts from the assets CloudFront distribution;
			// empty would produce "https:///cards/…" so fail loudly instead.
			assetsCdnDomain: props.assetsCdnDomain ?? "",
		},
	});

	return lambdaFunction;
};
