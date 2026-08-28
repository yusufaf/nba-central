import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { GetTeamResponse, SavedTeam } from "models/api/teams-api";
import { removeKeys } from "resources/dynamo/utilities";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const { sub: userUUID } = event.requestContext.authorizer.lambda;
	const teamUUID = event.pathParameters?.teamUUID || "";

	try {
		if (!teamUUID) {
			const response: GetTeamResponse = {
				success: false,
				error: "teamUUID is required",
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		// Bump lastViewed and read the item back in one call.
		const updateCommand = new UpdateCommand({
			TableName: mainTable,
			Key: {
				PK: `userUUID#${userUUID}`,
				SK: `team#${teamUUID}`,
			},
			UpdateExpression: "SET lastViewed = :lastViewed",
			ExpressionAttributeValues: {
				":lastViewed": new Date().getTime(),
			},
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
			ReturnValues: "ALL_NEW",
		});

		const dbResponse = await docClient.send(updateCommand);
		const team = dbResponse.Attributes as SavedTeam & { PK?: string; SK?: string };
		removeKeys(team);

		const response: GetTeamResponse = {
			success: true,
			data: team,
		};

		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error getting team:", err);

		if (err.name === "ConditionalCheckFailedException") {
			const response: GetTeamResponse = {
				success: false,
				error: "Team not found or not owned by user",
			};
			return {
				statusCode: 404,
				body: JSON.stringify(response),
			};
		}

		const response: GetTeamResponse = {
			success: false,
			error: err.message || "Failed to get team",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
