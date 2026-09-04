import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import {
    S3Client,
    CompleteMultipartUploadCommand,
    CompletedPart,
    HeadObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AuthorizerContext } from "models/auth";
import { isOwnedKey, parseRequestBody } from "utilities/request-body";

const { mainBucket = "" } = process.env;

const s3Client = new S3Client();

type RequestBody = {
    key: string;
    uploadId: string;
    parts: CompletedPart[];
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        const parsed = parseRequestBody<RequestBody>(event.body, {
            key: "string",
            uploadId: "string",
            parts: "array",
        });
        if (!parsed.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: parsed.error,
                }),
            };
        }
        const { key, uploadId, parts } = parsed.body;

        const sub = event.requestContext?.authorizer?.lambda?.sub;
        if (!isOwnedKey(key, sub)) {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    message: "Forbidden",
                }),
            };
        }

        const completeMultipartUploadCommand =
            new CompleteMultipartUploadCommand({
                Bucket: mainBucket,
                Key: key,
                UploadId: uploadId,
                MultipartUpload: {
                    Parts: parts,
                },
            });
        await s3Client.send(completeMultipartUploadCommand);

        // Getting file metadata
        const splitKey = key.split("/");
        const fileName = splitKey[splitKey.length - 1];
        const headObjectCommand = new HeadObjectCommand({
            Bucket: mainBucket,
            Key: key,
        });
        const s3HeadObject = await s3Client.send(headObjectCommand);
        const fileSize = s3HeadObject.ContentLength || 0;
        const getObjectCommand = new GetObjectCommand({
            Bucket: mainBucket,
            Key: key,
        });
        const signedURL = await getSignedUrl(s3Client, getObjectCommand, {
            expiresIn: 86400, // One day in seconds
        });

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
