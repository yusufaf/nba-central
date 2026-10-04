import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { AuthorizerContext } from "models/auth";
import { DeleteCustomArenaResponse } from "models/api/custom-entities-api";
import { customArenaKey, getCustomArena } from "resources/dynamo/arenas";
import {
	arenaImagesPrefix,
	deleteKeys,
	invalidateKeys,
	listKeys,
} from "utilities/assets-objects";

const { mainTable = "", assetsBucket = "", assetsDistributionId = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: DeleteCustomArenaResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

/*
 * The images go first and the item last. The ownership check reads the
 * item, and the prefix comes from it, so if the S3 cleanup fails the item
 * is still there and a retry finds the same images. Teams that used the
 * arena aren't touched: they keep its text and show it without the images.
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
	if (!arenaUUID) {
		return fail(400, "arenaUUID is required");
	}

	try {
		const arena = await getCustomArena(docClient, mainTable, userUUID, arenaUUID);
		if (!arena) {
			return fail(404, "Arena not found or not owned by user");
		}

		const keys = await listKeys(s3Client, assetsBucket, arenaImagesPrefix(arena.arenaUUID));
		await deleteKeys(s3Client, assetsBucket, keys);
		await invalidateKeys(cloudFrontClient, assetsDistributionId, keys, `delete-arena-${arenaUUID}`);

		await docClient.send(
			new DeleteCommand({ TableName: mainTable, Key: customArenaKey(userUUID, arenaUUID) }),
		);

		// `data` is void, but the union still requires the key.
		const response: DeleteCustomArenaResponse = { success: true, data: undefined };
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		console.error("Error deleting arena:", err);
		return fail(500, "Failed to delete arena");
	}
};
