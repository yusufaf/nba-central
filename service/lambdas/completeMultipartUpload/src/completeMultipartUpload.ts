import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { S3Client, CompleteMultipartUploadCommand, CompletedPart, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AuthorizerContext } from "models/auth";

const { mainS3Bucket = "" } = process.env;

const s3Client = new S3Client();

type RequestBody = {
    key: string;
    uploadId: string;
    parts: CompletedPart[]
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    const body: RequestBody = JSON.parse(event.body ?? "");
    const { key, uploadId, parts } = body;

    try {
        const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
            Bucket: mainS3Bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts
            }
        });
        const completeMultipartUploadResponse = await s3Client.send(completeMultipartUploadCommand);

        // Getting file metadata
        const splitKey = key.split("/");
        const [fileName] = splitKey[splitKey.length - 1];
        const headObjectCommand = new HeadObjectCommand({
            Bucket: mainS3Bucket,
            Key: key,
        });
        const s3HeadObject = await s3Client.send(headObjectCommand);
        const fileSize = s3HeadObject.ContentLength || 0;
        const getObjectCommand = new GetObjectCommand({
            Bucket: mainS3Bucket,
            Key: key,
        })
        const signedURL = getSignedUrl(s3Client, getObjectCommand, {
            expiresIn: 86400 // One day in seconds
        })
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                name: fileName,
                key,
                size: fileSize,
                signedURL,
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error",
            }),
        };
    }
};
