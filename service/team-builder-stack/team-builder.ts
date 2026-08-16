import { Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ExtendedStackProps } from "models/stack";
import { TeamBuilderAPI } from "./team-builder-api";
import { TeamBuilderDynamoDB } from "./team-builder-dynamo";
import { TeamBuilderS3 } from "./team-builder-s3";
import { TeamBuilderCognito } from "./team-builder-cognito";
import { TeamBuilderWeb } from "./team-builder-web";

export class TeamBuilder extends Construct {
    appName: string;
    deploymentType: string;

    constructor(scope: Construct, id: string, props: ExtendedStackProps) {
        super(scope, id);

        const { appName = "team-builder", deploymentType = "development" } =
            props;
        this.appName = appName;
        this.deploymentType = deploymentType;

        const api = new TeamBuilderAPI(
            scope,
            `${appName}-${deploymentType}-api`,
            props
        );
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

        // S3 + CloudFront for the public site is production-only — no
        // public domain exists for development.
        if (deploymentType === "production") {
            // HttpApi.apiEndpoint is a full URL token
            // ("https://{id}.execute-api.{region}.amazonaws.com"); strip the
            // scheme to get the regional domain name HttpOrigin expects.
            const apiDomainName = Fn.select(2, Fn.split("/", api.api.apiEndpoint));

            new TeamBuilderWeb(scope, `${appName}-${deploymentType}-web`, {
                ...props,
                apiDomainName,
            });
        }
    }
}
