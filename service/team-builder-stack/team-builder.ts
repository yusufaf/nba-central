import { Construct } from "constructs";
import { ExtendedStackProps } from "../../models/stack";
import { Table, AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy } from "aws-cdk-lib";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { TeamBuilderAPI } from "./team-builder-api";

export class TeamBuilder extends Construct {
    appName: string;
    deploymentType: string;

    constructor(scope: Construct, id: string, props: ExtendedStackProps) {
        super(scope, id);

        const { appName = "team-builder", deploymentType = "development" } =
            props;
        this.appName = appName;
        this.deploymentType = deploymentType;

        const apiID = `${appName}-${deploymentType}-api`;
        new TeamBuilderAPI(scope, apiID, props);

        this.createDynamoDBTables();
        this.createS3Buckets();
    }

    createDynamoDBTables = () => {
        const mainTableNameAndID = `${this.appName}-${this.deploymentType}-main-table`;
        const mainDynamoDBTable = new Table(this, mainTableNameAndID, {
            tableName: mainTableNameAndID,
            partitionKey: { name: "PK", type: AttributeType.STRING },
            sortKey: { name: "SK", type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
        });
    };

    createS3Buckets = () => {
        const mainBucketNameAndID = `${this.appName}-${this.deploymentType}-main-bucket`;
        const mainBucket = new Bucket(this, mainBucketNameAndID, {
            bucketName: mainBucketNameAndID,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN,
        });

        const assetsBucketNameAndID = `${this.appName}-${this.deploymentType}-assets-bucket`;
        const assetsBucket = new Bucket(this, assetsBucketNameAndID, {
            bucketName: assetsBucketNameAndID,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN,
        });
    };
}
