import { Duration } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import path from "path";
import { LambdaProps } from "../../../models/stack";
import { getRole } from "../../../resources/roles";
import { ESPN_TEAMS_URL } from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const { appName, deploymentType = "" } = props;

	const functionName = "getTeamLogos";
	const nameAndID = `${appName}-${deploymentType}-${functionName}`;
	const role = getRole(`${appName}-${deploymentType}-main-lambda-role`);

	const getTeamLogos = new NodejsFunction(construct, nameAndID, {
		functionName: nameAndID,
		runtime: Runtime.NODEJS_LATEST,
		timeout: Duration.seconds(30),
		role,
		memorySize: 1000,
		entry: path.join(__dirname, `./src/${functionName}.ts`),
		handler: "handler",
		awsSdkConnectionReuse: true,
		environment: {
			deploymentType,
			NODE_OPTIONS: "--enable-source-maps",
			ESPN_TEAMS_URL,
		},
	});

	return getTeamLogos;
};
