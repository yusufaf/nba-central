import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { GetUserSettingsResponse } from "models/api/user-settings-api";
import { pickValidSettings, settingsItemKey } from "models/user-settings";

const { usersTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	// The user is whoever the authorizer verified — never an id from the
	// request, or any caller could read anyone's settings.
	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		const response: GetUserSettingsResponse = {
			success: false,
			error: "Unauthorized",
		};
		return { statusCode: 401, body: JSON.stringify(response) };
	}

	try {
		const { Item } = await docClient.send(
			new GetCommand({
				TableName: usersTable,
				Key: settingsItemKey(userUUID),
				ProjectionExpression: "settings, settingsUpdatedAt",
			}),
		);

		const response: GetUserSettingsResponse = {
			success: true,
			data: {
				settings: pickValidSettings(Item?.settings),
				updatedAt: Item?.settingsUpdatedAt ?? null,
			},
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		console.error("Error getting user settings:", err);
		const response: GetUserSettingsResponse = {
			success: false,
			error: (err instanceof Error && err.message) || "Failed to get settings",
		};
		return { statusCode: 500, body: JSON.stringify(response) };
	}
};
