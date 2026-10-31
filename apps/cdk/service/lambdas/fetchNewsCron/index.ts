import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { ESPN_NEWS_URL } from "../../../constants";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "fetchNewsCron";
	const {
		appName = "team-builder",
		deploymentType = "development",
	} = props;
	const mainTableName = `${appName}-${deploymentType}-main`;

	const { lambdaFunction } = new TeamBuilderLambda(
		construct,
		functionName,
		{
			functionName,
			stackProps: props,
			memorySize: 512,
			timeout: Duration.seconds(30),
			environment: {
				ESPN_NEWS_URL,
				MAIN_TABLE_NAME: mainTableName,
			},
			// An isolated timeout or flaky feed recovers on the next
			// 15-minute run, so neither a retry nor one failure is worth an
			// email; three failed runs within two hours is a broken cron.
			monitor: { failuresToAlarm: 3 },
			functionProps: { retryAttempts: 0 },
		},
	);

	// Run every 15 minutes
	const rule = new Rule(construct, `${functionName}-rule`, {
		schedule: Schedule.rate(Duration.minutes(15)),
	});
	rule.addTarget(new LambdaFunction(lambdaFunction));

	return lambdaFunction;
};
