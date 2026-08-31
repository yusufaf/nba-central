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
		},
	);

	// Run every 15 minutes
	const rule = new Rule(construct, `${functionName}-rule`, {
		schedule: Schedule.rate(Duration.minutes(15)),
	});
	rule.addTarget(new LambdaFunction(lambdaFunction));

	return lambdaFunction;
};
