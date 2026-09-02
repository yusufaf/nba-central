import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { S3Client, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import { parseRequestBody } from "utilities/request-body";

const { mainBucket = "" } = process.env;

const s3Client = new S3Client();

type RequestBody = {
    studysetUUID: string;
    uploadType: string;
    userUUID: string;
    fileName: string;
    contentType: string;
};

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        // contentType is not required: S3 falls back to a default and the
        // object is still usable, unlike the three fields the key is built
        // from, which would otherwise produce "undefined/undefined/undefined".
        const parsed = parseRequestBody<RequestBody>(event.body, {
            studysetUUID: "string",
            userUUID: "string",
            fileName: "string",
        });
        if (!parsed.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: parsed.error,
                }),
            };
        }
        const { contentType, fileName, studysetUUID, userUUID } = parsed.body;

        const key = `${studysetUUID}/${userUUID}/${fileName}`;

        const multipartCommand = new CreateMultipartUploadCommand({
            Bucket: mainBucket,
            Key: key,
            ContentType: contentType,
        });
        const multipartUploadResponse = await s3Client.send(multipartCommand);
        return {
            statusCode: 200,
            body: JSON.stringify({
                key,
                uploadId: multipartUploadResponse.UploadId,
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
