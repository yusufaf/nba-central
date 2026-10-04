import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { AuthorizerContext } from "models/auth";
import { ARENA_IMAGE_SLOTS, ArenaImageSlot } from "models/custom-entities";
import { DeleteArenaImageResponse } from "models/api/custom-entities-api";
import { customArenaKey, getCustomArena } from "resources/dynamo/arenas";
import { arenaImagesPrefix, invalidateKeys } from "utilities/assets-objects";

const { mainTable = "", assetsBucket = "", assetsDistributionId = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});

const isSlot = (value: string): value is ArenaImageSlot =>
	(ARENA_IMAGE_SLOTS as readonly string[]).includes(value);

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: DeleteArenaImageResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

const ok = (): APIGatewayProxyResultV2 => {
	const response: DeleteArenaImageResponse = { success: true, data: undefined };
	return { statusCode: 200, body: JSON.stringify(response) };
};

/*
 * Removes one image slot from the caller's own arena. The item stops
 * pointing at the image before the object goes: if the S3 delete then
 * fails, nothing shows a broken image, and the arena delete's prefix sweep
 * still finds the object.
 */
export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		return fail(401, "Unauthorized");
	}
	const arenaUUID = event.pathParameters?.arenaUUID ?? "";
	const slot = event.pathParameters?.slot ?? "";
	if (!arenaUUID) {
		return fail(400, "arenaUUID is required");
	}
	if (!isSlot(slot)) {
		return fail(400, `slot must be one of ${ARENA_IMAGE_SLOTS.join(", ")}`);
	}

	try {
		const arena = await getCustomArena(docClient, mainTable, userUUID, arenaUUID);
		if (!arena) {
			return fail(404, "Arena not found or not owned by user");
		}
		const key = arena[`${slot}Key`];
		if (!key) {
			return ok();
		}

		await docClient.send(
			new UpdateCommand({
				TableName: mainTable,
				Key: customArenaKey(userUUID, arenaUUID),
				UpdateExpression: "SET #updated = :updated REMOVE #url, #key",
				ExpressionAttributeNames: {
					"#url": `${slot}Url`,
					"#key": `${slot}Key`,
					"#updated": "updated",
				},
				ExpressionAttributeValues: { ":updated": new Date().toISOString() },
				ConditionExpression: "attribute_exists(PK)",
			}),
		);

		if (key.startsWith(arenaImagesPrefix(arenaUUID))) {
			try {
				await s3Client.send(new DeleteObjectCommand({ Bucket: assetsBucket, Key: key }));
				await invalidateKeys(cloudFrontClient, assetsDistributionId, [key], `delete-arena-image-${arenaUUID}`);
			} catch (err) {
				console.error("Error removing arena image:", err);
			}
		}

		return ok();
	} catch (err) {
		if ((err as Error).name === "ConditionalCheckFailedException") {
			return fail(404, "Arena not found or not owned by user");
		}
		console.error("Error removing arena image:", err);
		return fail(500, "Failed to remove image");
	}
};
