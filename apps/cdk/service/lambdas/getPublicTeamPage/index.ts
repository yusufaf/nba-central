import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { SITE_URL } from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getPublicTeamPage";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(10),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			// Name, not a construct reference: TeamBuilderWeb is created after
			// the API (and only in production). The bucket name is
			// deterministic, so the Lambda can be wired without a dependency.
			webBucket: `${props.appName}-${props.deploymentType}-web`,
			siteUrl: SITE_URL,
		},
	});

	return lambdaFunction;
};
