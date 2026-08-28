import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { UpdateTeamPayload, UpdateTeamResponse, SavedTeam } from "models/api/teams-api";
import { validateTeamData } from "utilities/team-validation";
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

	try {
		const payload: UpdateTeamPayload = JSON.parse(event.body || "{}");

		if (!payload.teamUUID || typeof payload.teamUUID !== "string") {
			const response: UpdateTeamResponse = {
				success: false,
				error: "teamUUID is required and must be a string",
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const validation = validateTeamData(payload);
		if (!validation.valid) {
			const response: UpdateTeamResponse = {
				success: false,
				error: validation.error!,
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const timestamp = new Date().getTime();

		const updateCommand = new UpdateCommand({
			TableName: mainTable,
			Key: {
				PK: `userUUID#${userUUID}`,
				SK: `team#${payload.teamUUID}`,
			},
			UpdateExpression:
				"SET updatedAt = :updatedAt, title = :title, description = :description, " +
				"city = :city, country = :country, logoUrl = :logoUrl, playerCount = :playerCount, " +
				"roster = :roster, coach = :coach, gm = :gm, arena = :arena",
			ExpressionAttributeValues: {
				":updatedAt": timestamp,
				":title": payload.title.trim(),
				":description": payload.description || "",
				":city": payload.city || "",
				":country": payload.country || "",
				":logoUrl": payload.logoUrl || "",
				":playerCount": payload.roster.length,
				":roster": payload.roster,
				":coach": payload.coach ?? null,
				":gm": payload.gm ?? null,
				":arena": payload.arena ?? null,
			},
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
			ReturnValues: "ALL_NEW",
		});

		const dbResponse = await docClient.send(updateCommand);
		const team = dbResponse.Attributes as SavedTeam & { PK?: string; SK?: string };
		removeKeys(team);

		const response: UpdateTeamResponse = {
			success: true,
			data: team,
		};

		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error updating team:", err);

		if (err.name === "ConditionalCheckFailedException") {
			const response: UpdateTeamResponse = {
				success: false,
				error: "Team not found or not owned by user",
			};
			return {
				statusCode: 404,
				body: JSON.stringify(response),
			};
		}

		const response: UpdateTeamResponse = {
			success: false,
			error: err.message || "Failed to update team",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
