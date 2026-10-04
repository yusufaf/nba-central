import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { CustomArenaItem } from "models/custom-entities";
import { ListCustomArenasResponse } from "models/api/custom-entities-api";
import { CUSTOM_ARENA_SK_PREFIX, toArenaListItem } from "resources/dynamo/arenas";
import { userPartitionKey } from "resources/dynamo/user-data";

const { mainTable = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		const response: ListCustomArenasResponse = { success: true, data: { customArenas: [] } };
		return { statusCode: 200, body: JSON.stringify(response) };
	}

	try {
		// At most 20 small items, so one page always holds them all.
		const { Items = [] } = await docClient.send(
			new QueryCommand({
				TableName: mainTable,
				KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
				ExpressionAttributeValues: {
					":pk": userPartitionKey(userUUID),
					":sk": CUSTOM_ARENA_SK_PREFIX,
				},
			}),
		);

		const response: ListCustomArenasResponse = {
			success: true,
			data: { customArenas: (Items as CustomArenaItem[]).map(toArenaListItem) },
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		console.error("Error listing arenas:", err);
		const response: ListCustomArenasResponse = { success: false, error: "Failed to list arenas" };
		return { statusCode: 500, body: JSON.stringify(response) };
	}
};
