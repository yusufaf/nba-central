import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { AuthorizerContext } from "models/auth";
import { CustomArenaItem, MAX_CUSTOM_ARENAS } from "models/custom-entities";
import { CreateCustomArenaResponse } from "models/api/custom-entities-api";
import { toArenaFields, validateArenaData } from "utilities/custom-entities-validation";
import { parseRequestBody } from "utilities/request-body";
import {
	CUSTOM_ARENA_SK_PREFIX,
	customArenaKey,
	toArenaListItem,
} from "resources/dynamo/arenas";
import { userPartitionKey } from "resources/dynamo/user-data";

const { mainTable = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: CreateCustomArenaResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	// The item goes under the authorizer's sub; any id in the body is ignored.
	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		return fail(401, "Unauthorized");
	}

	const parsed = parseRequestBody<Record<string, unknown>>(event.body, {});
	if (!parsed.valid) {
		return fail(400, parsed.error);
	}
	const validation = validateArenaData(parsed.body);
	if (!validation.valid) {
		return fail(400, validation.error!);
	}

	try {
		// Two creates racing past this check could both land, leaving 21.
		// The cap bounds storage, so that's acceptable.
		const { Count = 0 } = await docClient.send(
			new QueryCommand({
				TableName: mainTable,
				KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
				ExpressionAttributeValues: {
					":pk": userPartitionKey(userUUID),
					":sk": CUSTOM_ARENA_SK_PREFIX,
				},
				Select: "COUNT",
			}),
		);
		if (Count >= MAX_CUSTOM_ARENAS) {
			return fail(400, `You can have up to ${MAX_CUSTOM_ARENAS} custom arenas`);
		}

		const arenaUUID = randomUUID();
		const timestamp = new Date().toISOString();
		const item: CustomArenaItem = {
			...customArenaKey(userUUID, arenaUUID),
			entityType: "customArena",
			created: timestamp,
			updated: timestamp,
			arenaUUID,
			...toArenaFields(parsed.body),
			createdBy: event.requestContext.authorizer.lambda.username,
		};

		await docClient.send(new PutCommand({ TableName: mainTable, Item: item }));

		const response: CreateCustomArenaResponse = { success: true, data: toArenaListItem(item) };
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		console.error("Error creating arena:", err);
		return fail(500, "Failed to create arena");
	}
};
