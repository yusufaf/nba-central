import { LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { getRole } from "../../../resources/roles";
import { LambdaProps } from "../../../models/stack";
import { Duration } from "aws-cdk-lib";
import path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { layerARNLookup } from "../../../resources/lambda";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";

export default ({ props, construct }: LambdaProps) => {
    const { appName, deploymentType = "" } = props;

    const functionName = "setArenasData";
    const nameAndID = `${appName}-${deploymentType}-${functionName}`;
    const role = getRole(`${appName}-${deploymentType}-main-lambda-role`);

    const setArenasData = new NodejsFunction(construct, nameAndID, {
        functionName: nameAndID,
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(30),
        role,
        memorySize: 1000,
        entry: path.join(__dirname, `./src/${functionName}.ts`),
        handler: "handler",
        awsSdkConnectionReuse: true,
        environment: {
            deploymentType,
            NODE_OPTIONS: "--enable-source-maps",
            staticDataBucket: `${appName}-${deploymentType}-static-data`,
        },
        layers: [
            LayerVersion.fromLayerVersionArn(
                construct,
                `${nameAndID}-nfjsd`,
                layerARNLookup["node-fetch_cheerio"]
            ),
        ],
        bundling: {},
    });

    new Rule(construct, `${nameAndID}-data-update`, {
        ruleName: `${deploymentType}-arenas-data-update`,
        description: "Regular update to the arenas.json static data file",
        targets: [new LambdaFunction(setArenasData)],
        schedule: Schedule.rate(Duration.days(365)),
    });

    return setArenasData;
};
