import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "publishCapFive";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		monitor: {},
		memorySize: 512,
		timeout: Duration.minutes(1),
		environment: {
			staticDataBucket: `${props.appName}-${props.deploymentType}-static-data`,
		},
		// A published day must never change, and only PutObject's IfNoneMatch
		// stops an overwrite. The runtime's built-in SDK may be too old to know
		// that field, and an SDK that doesn't would drop it silently and
		// overwrite the day, so this Lambda ships the lockfile's SDK instead.
		bundling: { bundleAwsSDK: true },
		schedule: {
			enabled: true,
			description:
				"Daily: freezes upcoming Cap Five puzzles (cap-five/<date>.json) from the current player-ratings.json",
			rate: Duration.days(1),
		},
	});

	return lambdaFunction;
};
