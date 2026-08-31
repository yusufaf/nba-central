import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { DeleteTeamResponse } from "models/api/teams-api";

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
			const response: DeleteTeamResponse = {
				success: false,
				error: "teamUUID is required",
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const deleteCommand = new DeleteCommand({
			TableName: mainTable,
			Key: {
				PK: `userUUID#${userUUID}`,
				SK: `team#${teamUUID}`,
			},
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
		});

		await docClient.send(deleteCommand);

		const response: DeleteTeamResponse = {
			success: true,
			data: undefined,
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error deleting team:", err);

		if (err.name === "ConditionalCheckFailedException") {
			const response: DeleteTeamResponse = {
				success: false,
				error: "Team not found or not owned by user",
			};
			return {
				statusCode: 404,
				body: JSON.stringify(response),
			};
		}

		const response: DeleteTeamResponse = {
			success: false,
			error: err.message || "Failed to delete team",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
