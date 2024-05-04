import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { S3Client, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";

const { mainS3Bucket = "" } = process.env;

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
    
    const body: RequestBody = JSON.parse(event.body ?? "");
    const { contentType, fileName, studysetUUID, uploadType, userUUID } = body;
    
    const key = `${studysetUUID}/${userUUID}/${fileName}`;

    try {
        const multipartCommand = new CreateMultipartUploadCommand({
            Bucket: mainS3Bucket,
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
