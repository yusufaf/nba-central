import { Construct } from "constructs";
import { ExtendedStackProps, LambdaProps } from "models/stack";
import { LambdaIntegration, Resource } from "aws-cdk-lib/aws-apigateway";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import {
    Role,
    ServicePrincipal,
    PolicyStatement,
    ManagedPolicy,
    Effect,
} from "aws-cdk-lib/aws-iam";
import { addRole } from "../../resources/roles";
import {
    capitalizeFirstLetter,
    getDefaultExportForLambda,
} from "../../utilities/generalUtils";
import {
    CfnStage,
    CorsHttpMethod,
    HttpApi,
    HttpAuthorizer,
    HttpAuthorizerType,
    HttpMethod,
    HttpStage,
    IHttpRouteAuthorizer,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { DEFAULT_ALLOWED_ORIGINS } from "../../constants";
import apiAuthorizer from "../lambdas/apiAuthorizer/index";
import setCoachesData from "../lambdas/setCoachesData";
import setExecsData from "../lambdas/setExecsData";
import setArenasData from "../lambdas/setArenasData";

type CreateLambdaProxyIntegrationProps = {
    lambda: LambdaFunction;
    httpMethod: string;
    methodName: string;
    parentResource: Resource;
};

export class TeamBuilderAPI extends Construct {
    account: string;
    appName: string;
    deploymentType: string;
    region: string;
    prefix: string;

    constructor(scope: Construct, id: string, props: ExtendedStackProps) {
        super(scope, id);

        const {
            appName = "team-builder",
            deploymentType = "development",
            env,
        } = props;
        // @ts-ignore env should be defined
        const { account = "", region = "" } = env;

        this.account = account;
        this.region = region;
        this.appName = appName;
        this.deploymentType = deploymentType;
        this.prefix = `${appName}-${deploymentType}`;

        const apiNameAndID = `${this.prefix}-main`;
        const api = new HttpApi(this, apiNameAndID, {
            apiName: apiNameAndID,
            description: `${capitalizeFirstLetter(
                deploymentType
            )} API for Team Builder`,
            corsPreflight: {
                allowHeaders: [
                    "Content-Type",
                    "X-Amz-Date",
                    "Authorization",
                    "X-Api-Key",
                ],
                allowMethods: [
                    CorsHttpMethod.OPTIONS,
                    CorsHttpMethod.GET,
                    CorsHttpMethod.POST,
                    CorsHttpMethod.PUT,
                    CorsHttpMethod.PATCH,
                    CorsHttpMethod.DELETE,
                ],
                allowCredentials: true,
                allowOrigins: DEFAULT_ALLOWED_ORIGINS,
            },
        });

        // Setup the access log for APIGWv2
        const logGroupNameAndID = `${this.prefix}-api-AccessLogs`;
        const accessLogs = new LogGroup(this, logGroupNameAndID, {
            logGroupName: logGroupNameAndID,
        });
        const stage = api.defaultStage?.node.defaultChild as CfnStage;
        stage.accessLogSettings = {
            destinationArn: accessLogs.logGroupArn,
            format: JSON.stringify({
                requestId: "$context.requestId",
                userAgent: "$context.identity.userAgent",
                sourceIp: "$context.identity.sourceIp",
                requestTime: "$context.requestTime",
                requestTimeEpoch: "$context.requestTimeEpoch",
                httpMethod: "$context.httpMethod",
                path: "$context.path",
                status: "$context.status",
                protocol: "$context.protocol",
                responseLength: "$context.responseLength",
                domainName: "$context.domainName",
                authorizerError: "$context.authorizer.error",
            }),
        };

        const apiGatewayLogWriterRole = new Role(this, "ApiGWLogWriterRole", {
            assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
        });

        const policy = new PolicyStatement({
            actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents",
                "logs:GetLogEvents",
                "logs:FilterLogEvents",
            ],
            resources: ["*"],
        });
        apiGatewayLogWriterRole.addToPolicy(policy);
        accessLogs.grantWrite(apiGatewayLogWriterRole);

        new HttpStage(this, `${deploymentType}-stage}`, {
            httpApi: api,
            stageName: deploymentType,
        });

        this.createUpdateLambdaRoles();

        const lambdaProps = {
            construct: this,
            props,
        };

        setCoachesData({ ...lambdaProps });
        setExecsData({ ...lambdaProps });
        setArenasData({ ...lambdaProps });

        const authorizerNameAndID = `${this.prefix}-authorizer`;
        const apiAuthorizerLambda = apiAuthorizer({ ...lambdaProps });

        // Grant API Gateway permission to invoke the authorizer Lambda function
        apiAuthorizerLambda.grantInvoke(
            new ServicePrincipal("apigateway.amazonaws.com")
        );

        const authorizerUri = `arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/${apiAuthorizerLambda.functionArn}/invocations`;
        const httpAuthorizer = new HttpAuthorizer(this, authorizerNameAndID, {
            authorizerName: authorizerNameAndID,
            authorizerUri,
            httpApi: api,
            identitySource: ["$request.header.Authorization"],
            // identitySources: [IdentitySource.header("Authorization")]
            type: HttpAuthorizerType.LAMBDA,
            enableSimpleResponses: true,
        });

        const httpRouteAuthorizer = HttpAuthorizer.fromHttpAuthorizerAttributes(
            this,
            `http-route-authorizer`,
            {
                authorizerId: httpAuthorizer.authorizerId,
                authorizerType: "CUSTOM",
            }
        );

        const filesPrefix = `/api/files`;
        const usersPrefix = `/api/users`;

        const FILES_ROUTES = [
            {
                route: `${filesPrefix}/initiate-multipart-upload`,
                lambdaName: "initiateMultipartUpload",
            },
            {
                route: `${filesPrefix}/complete-multipart-upload`,
                lambdaName: "completeMultipartUpload",
            },
            {
                route: `${filesPrefix}/get-multipart-signed-upload-urls`,
                lambdaName: "getMultipartSignedUploadUrls",
            },
            {
                route: `${filesPrefix}/delete-file`,
                lambdaName: "deleteFile",
            },
        ];

        const USERS_ROUTES: {
            route: string;
            lambdaName: string;
            methods?: HttpMethod[] | undefined;
        }[] = [
            {
                route: `${usersPrefix}/get`,
                lambdaName: "getUser",
            },
        ];

        const API_ROUTES = [...FILES_ROUTES];

        for (const { route, lambdaName } of API_ROUTES) {
            this.createLambdaHttpIntegration({
                api,
                lambdaProps,
                path: route,
                lambdaName,
                authorizer: httpRouteAuthorizer,
            });
        }
    }

    createUpdateLambdaRoles = () => {
        const mainLambdaRoleNameAndID = `${this.appName}-${this.deploymentType}-main-lambda-role`;
        const mainLambdaRole = new Role(this, mainLambdaRoleNameAndID, {
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
            roleName: mainLambdaRoleNameAndID,
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName(
                    "service-role/AWSLambdaBasicExecutionRole"
                ),
            ],
        });

        // Add a policy statement for DynamoDB access
        const dynamoTableResources = [`main`, `users`].map(
            (tableName) =>
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${this.prefix}-${tableName}`
        );
        const dynamoDBPolicyStatement = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
            ],
            resources: dynamoTableResources,
        });
        mainLambdaRole.addToPolicy(dynamoDBPolicyStatement);

        // Add a policy statement for S3 read and write access
        const s3BucketResources = [`main`, `assets`, `static-data`]
            .map((bucketName) => [
                `arn:aws:s3:::${bucketName}`,
                `arn:aws:s3:::${this.prefix}-${bucketName}/*`,
            ])
            .flat();
        const s3PolicyStatement = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket",
                "s3:DeleteObject",
                "s3:AbortMultipartUpload",
                "s3:ListMultipartUploadParts",
            ],
            resources: s3BucketResources,
        });
        mainLambdaRole.addToPolicy(s3PolicyStatement);
        addRole(mainLambdaRoleNameAndID, mainLambdaRole);
    };

    createLambdaProxyIntegration = ({
        httpMethod,
        lambda,
        methodName,
        parentResource,
    }: CreateLambdaProxyIntegrationProps) => {
        const lambdaIntegration = new LambdaIntegration(lambda, {
            proxy: true,
        });
        const resource = parentResource.addResource(methodName);
        resource.addMethod(httpMethod, lambdaIntegration, {});
    };

    createLambdaHttpIntegration = async ({
        api,
        lambdaProps,
        methods = [HttpMethod.POST],
        path,
        lambdaName,
        authorizer,
    }: {
        api: HttpApi;
        lambdaName: string;
        lambdaProps: any;
        methods?: HttpMethod[];
        path: string;
        authorizer?: IHttpRouteAuthorizer;
    }) => {
        const lambdaFunction: (props: LambdaProps) => NodejsFunction =
            await getDefaultExportForLambda(lambdaName);

        api.addRoutes({
            path,
            methods,
            integration: new HttpLambdaIntegration(
                `${this.deploymentType}-${lambdaName}-integration`,
                lambdaFunction({ ...lambdaProps }),
                {}
            ),
            authorizer,
        });
    };
}
