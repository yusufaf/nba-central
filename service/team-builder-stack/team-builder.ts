import { CfnOutput, Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ExtendedStackProps } from "models/stack";
import { TeamBuilderAPI } from "./team-builder-api";
import { TeamBuilderDynamoDB } from "./team-builder-dynamo";
import { TeamBuilderS3 } from "./team-builder-s3";
import { TeamBuilderWeb } from "./team-builder-web";
import { TeamBuilderDeployRole } from "./team-builder-deploy-role";

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

        new CfnOutput(scope, `${appName}-${deploymentType}-api-endpoint`, {
            value: api.api.apiEndpoint,
        });

        // S3 + CloudFront for the public site is production-only — no
        // public domain exists for development.
        if (deploymentType === "production") {
            // HttpApi.apiEndpoint is a full URL token
            // ("https://{id}.execute-api.{region}.amazonaws.com"); strip the
            // scheme to get the regional domain name HttpOrigin expects.
            const apiDomainName = Fn.select(2, Fn.split("/", api.api.apiEndpoint));

            const web = new TeamBuilderWeb(scope, `${appName}-${deploymentType}-web`, {
                ...props,
                apiDomainName,
            });

            const deployRole = new TeamBuilderDeployRole(
                scope,
                `${appName}-${deploymentType}-deploy-role-construct`,
                {
                    ...props,
                    githubRepo: "yusufaf/nba-central",
                    bucket: web.bucket,
                    distribution: web.distribution,
                },
            );

            // Values the deploy runbook / GitHub Actions workflow needs —
            // read them from `cdk deploy`'s output rather than re-deriving.
            new CfnOutput(scope, `${appName}-${deploymentType}-web-bucket-name`, {
                value: web.bucket.bucketName,
            });
            new CfnOutput(
                scope,
                `${appName}-${deploymentType}-distribution-id`,
                { value: web.distribution.distributionId },
            );
            new CfnOutput(scope, `${appName}-${deploymentType}-deploy-role-arn`, {
                value: deployRole.roleArn,
            });
        }
    }
}
