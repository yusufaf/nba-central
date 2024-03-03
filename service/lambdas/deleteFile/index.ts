import { Runtime } from "aws-cdk-lib/aws-lambda";
import { getRole } from "../../../resources/roles";
import { LambdaProps } from "../../../models/stack";
import { Duration } from "aws-cdk-lib";
import path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export default ({
    props,
    construct
}: LambdaProps) => {
    const { appName, deploymentType = "" } = props;

    const functionName = "deleteFile";
    const nameAndID = `${deploymentType}-${functionName}`
    const role = getRole(`${deploymentType}-main-lambda-role`)

    const lambdaFunction = new NodejsFunction(construct, nameAndID, {
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
            NODE_OPTIONS: '--enable-source-maps',
            mainDynamoDBTable: `${appName}-${deploymentType}-main-table`,
            mainS3Bucket: `${appName}-${deploymentType}-main-bucket`,
        } 
    })

    return lambdaFunction;
}

