import { RemovalPolicy } from "aws-cdk-lib";
import {
    Bucket,
    BlockPublicAccess,
    HttpMethods,
    CorsRule,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ExtendedStackProps } from "models/stack";
import { DEFAULT_ALLOWED_ORIGINS } from "./../../constants/index";

export class TeamBuilderS3 extends Construct {
    // Exposed for TeamBuilderAssetsCdn, which fronts this one bucket with a
    // public read-only CloudFront distribution.
    readonly assetsBucket: Bucket;

    constructor(scope: Construct, id: string, props: ExtendedStackProps) {
        super(scope, id);
        const {
            appName = "team-builder",
            deploymentType = "development",
        } = props;

        const mainTableNameAndID = `${appName}-${deploymentType}-main`;
        this.createS3Bucket({
            bucketName: mainTableNameAndID,
            cors: [
                {
                    allowedMethods: [
                        HttpMethods.GET,
                        HttpMethods.PUT,
                        HttpMethods.POST,
                        HttpMethods.DELETE,
                    ],
                    allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
                    allowedHeaders: ["*"],
                    maxAge: 3600, // 1hr
                },
            ],
        });

        const assetsBucketNameAndID = `${appName}-${deploymentType}-assets`;
        this.assetsBucket = this.createS3Bucket({
            bucketName: assetsBucketNameAndID,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET],
                    allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
                    allowedHeaders: ["*"],
                    maxAge: 3600, // 1hr
                },
            ],
        });

        const staticDataBucketNameAndID = `${appName}-${deploymentType}-static-data`;
        this.createS3Bucket({
            bucketName: staticDataBucketNameAndID,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET],
                    allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
                    allowedHeaders: ["*"],
                    maxAge: 3600, // 1hr
                },
            ],
        });
    }

    createS3Bucket = ({
        bucketName,
        cors,
    }: {
        bucketName: string;
        cors?: CorsRule[];
    }): Bucket => {
        const s3Bucket = new Bucket(this, bucketName, {
            bucketName,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN,
            versioned: true,
            cors,
        });
        return s3Bucket;
    };
}
