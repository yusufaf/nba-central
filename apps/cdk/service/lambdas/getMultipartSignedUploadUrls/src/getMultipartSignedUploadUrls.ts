import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import {
    S3Client,
    UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AuthorizerContext } from "models/auth";
import { parseRequestBody } from "utilities/request-body";

// S3's hard limit on parts in a single multipart upload. Signing beyond it
// can only produce URLs the upload will reject, and a large numParts would
// otherwise sign that many URLs before failing.
const MAX_PARTS = 10000;

const { mainBucket = "" } = process.env;

const s3Client = new S3Client();

type RequestBody = {
    key: string;
    uploadId: string;
    numParts: number;
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
            numParts: "number",
        });
        if (!parsed.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: parsed.error,
                }),
            };
        }
        const { key, uploadId, numParts } = parsed.body;

        if (
            !Number.isInteger(numParts) ||
            numParts < 1 ||
            numParts > MAX_PARTS
        ) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: `numParts must be an integer between 1 and ${MAX_PARTS}`,
                }),
            };
        }

        const promises: Promise<string>[] = [];
        for (let index = 0; index < numParts; index++) {
            const uploadPartCommand = new UploadPartCommand({
                Bucket: mainBucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: index + 1,
            });

            promises.push(
                getSignedUrl(s3Client, uploadPartCommand, {
                    expiresIn: 3600, // One hour in seconds
                })
            );
        }

        const uploadPartsResult = await Promise.all(promises);
        const signedURLs = uploadPartsResult.reduce(
            (map: Record<number, string>, part, index) => {
                map[index] = part;
                return map;
            },
            {}
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                signedURLs,
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
