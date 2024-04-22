import { Construct } from "constructs";
import { ExtendedStackProps } from "models/stack";
import { TeamBuilderAPI } from "./team-builder-api";
import { TeamBuilderDynamoDB } from "./team-builder-dynamo";
import { TeamBuilderS3 } from "./team-builder-s3";
import { TeamBuilderCognito } from "./team-builder-cognito";

export class TeamBuilder extends Construct {
    appName: string;
    deploymentType: string;

    constructor(scope: Construct, id: string, props: ExtendedStackProps) {
        super(scope, id);

        const { appName = "team-builder", deploymentType = "development" } =
            props;
        this.appName = appName;
        this.deploymentType = deploymentType;

        new TeamBuilderAPI(scope, `${appName}-${deploymentType}-api`, props);
        new TeamBuilderDynamoDB(
            scope,
            `${appName}-${deploymentType}-dynamoDB`,
            props
        );
        new TeamBuilderS3(scope, `${appName}-${deploymentType}-s3`, props);
        new TeamBuilderCognito(
            scope,
            `${appName}-${deploymentType}-cognito`,
            props
        );
    }
}
