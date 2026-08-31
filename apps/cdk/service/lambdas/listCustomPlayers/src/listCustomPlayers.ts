import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { ListCustomPlayersResponse } from "models/api/custom-entities-api";

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
		const response: ListCustomPlayersResponse = {
			success: true,
			data: { customPlayers: [] },
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	}

	try {
		const queryCommand = new QueryCommand({
			TableName: mainTable,
			KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
			ExpressionAttributeValues: {
				":pk": `userUUID#${userUUID}`,
				":sk": "customPlayer#",
			},
		});

		const dbResponse = await docClient.send(queryCommand);

		const customPlayers = (dbResponse.Items || []).map((item: any) => ({
			playerUUID: item.playerUUID,
			name: item.name,
			position: item.position,
			heightFeet: item.heightFeet,
			heightInches: item.heightInches,
			weightPounds: item.weightPounds,
			overallRating: item.overallRating,
			created: item.created,
			isCustom: true as const,
		}));

		const response: ListCustomPlayersResponse = {
			success: true,
			data: { customPlayers },
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error listing Players:", err);
		const response: ListCustomPlayersResponse = {
			success: false,
			error: err.message || "Failed to list Players",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
