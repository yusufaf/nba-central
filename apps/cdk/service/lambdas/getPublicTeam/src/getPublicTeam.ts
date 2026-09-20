import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetPublicTeamResponse } from "models/api/teams-api";
import { queryPublicTeam } from "resources/dynamo/teams";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Anonymous: no authorizer on this route, so there is no caller context to
// read. Visibility is enforced by the query itself (SK2 = "public").
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const teamUUID = event.pathParameters?.teamUUID || "";
	if (!teamUUID) {
		const response: GetPublicTeamResponse = {
			success: false,
			error: "teamUUID is required",
		};
		return { statusCode: 400, body: JSON.stringify(response) };
	}

	try {
		const team = await queryPublicTeam(docClient, mainTable, teamUUID);
		if (!team) {
			const response: GetPublicTeamResponse = {
				success: false,
				error: "Team not found",
			};
			return { statusCode: 404, body: JSON.stringify(response) };
		}

		const response: GetPublicTeamResponse = { success: true, data: team };
		return {
			statusCode: 200,
			headers: { "cache-control": "no-cache" },
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error getting public team:", err);
		const response: GetPublicTeamResponse = {
			success: false,
			error: err.message || "Failed to get team",
		};
		return { statusCode: 500, body: JSON.stringify(response) };
	}
};
