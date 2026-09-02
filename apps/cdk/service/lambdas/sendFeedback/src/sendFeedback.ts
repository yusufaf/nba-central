import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Handler,
} from "aws-lambda";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const { mainBucket = "" } = process.env;

const s3Client = new S3Client();

type Body = {
    key: string;
};

export const handler: Handler = async (
    event: APIGatewayProxyEvent,
    context
): Promise<APIGatewayProxyResult> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    const body: Body = JSON.parse(event.body ?? "");
    const { key } = body;

    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: mainBucket,
            Key: key,
        });
        await s3Client.send(deleteCommand);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully deleted file",
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error deleting file",
            }),
        };
    }
};
