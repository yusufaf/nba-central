import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Handler,
} from "aws-lambda";
import { S3Client, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

const { mainS3Bucket = "" } = process.env;

const s3Client = new S3Client();

type Body = {
    studysetUUID: string;
    uploadType: string;
    userUUID: string;
    fileName: string;
    contentType: string;
};

export const handler: Handler = async (
    event: APIGatewayProxyEvent,
    context
): Promise<APIGatewayProxyResult> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    const body: Body = JSON.parse(event.body ?? "");
    const { 
        contentType, 
        fileName, 
        studysetUUID, 
        uploadType, 
        userUUID 
    } = body;

    const key = `${studysetUUID}/${userUUID}/${fileName}`;

    try {
        const multipartCommand = new CreateMultipartUploadCommand({
            Bucket: mainS3Bucket,
            Key: key,
            ContentType: contentType,
        });
        const multipartUploadResponse = await s3Client.send(multipartCommand);
        return {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "OPTIONS, POST",
            },
            statusCode: 200,
            body: JSON.stringify({
                key,
                uploadId: multipartUploadResponse.UploadId
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
