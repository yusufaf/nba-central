import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { ListTeamsResponse, TeamSummary } from "models/api/teams-api";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		const response: ListTeamsResponse = {
			success: true,
			data: { teams: [] },
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	}

	try {
		// Card fields only - roster/coach/gm/arena stay off this response so
		// listing a user's teams doesn't pull every saved roster over the wire.
		const queryCommand = new QueryCommand({
			TableName: mainTable,
			KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
			ExpressionAttributeValues: {
				":pk": `userUUID#${userUUID}`,
				":sk": "team#",
			},
			ProjectionExpression:
				"teamUUID, userUUID, username, title, description, city, country, logoUrl, jerseyUrl, playerCount, favorited, #lbl, lastViewed, createdAt, updatedAt",
			ExpressionAttributeNames: {
				"#lbl": "label",
			},
		});

		const dbResponse = await docClient.send(queryCommand);

		const teams = (dbResponse.Items || []) as TeamSummary[];

		const response: ListTeamsResponse = {
			success: true,
			data: { teams },
		};

		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error listing teams:", err);
		const response: ListTeamsResponse = {
			success: false,
			error: err.message || "Failed to list teams",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
