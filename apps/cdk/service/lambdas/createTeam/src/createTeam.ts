import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { AuthorizerContext } from "models/auth";
import { removeKeys } from "resources/dynamo/utilities";
import { teamGsiKey, PRIVATE_SK2 } from "resources/dynamo/teams";
import { CreateTeamResponse, SaveTeamPayload, SavedTeam } from "models/api/teams-api";
import { validateTeamData } from "utilities/team-validation";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const { sub: userUUID, username } = event.requestContext.authorizer.lambda;

	try {
		const payload: SaveTeamPayload = JSON.parse(event.body || "{}");

		const validation = validateTeamData(payload);
		if (!validation.valid) {
			const response: CreateTeamResponse = {
				success: false,
				error: validation.error!,
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const teamUUID = randomUUID();
		const timestamp = new Date().getTime();
		const initialTeam: SavedTeam & { PK: string; SK: string; PK2: string; SK2: string } = {
			PK: `userUUID#${userUUID}`,
			SK: `team#${teamUUID}`,
			PK2: teamGsiKey(teamUUID),
			SK2: PRIVATE_SK2,
			teamUUID,
			userUUID,
			username,
			title: payload.title.trim(),
			description: payload.description || "",
			city: payload.city || "",
			country: payload.country || "",
			logoUrl: payload.logoUrl || "",
			jerseyUrl: payload.jerseyUrl || "",
			playerCount: payload.roster.length,
			roster: payload.roster,
			coach: payload.coach ?? null,
			gm: payload.gm ?? null,
			arena: payload.arena ?? null,
			favorited: false,
			label: "",
			public: false,
			lastViewed: timestamp,
			createdAt: timestamp,
			updatedAt: timestamp,
		};

		const putCommand = new PutCommand({
			TableName: mainTable,
			Item: initialTeam,
		});

		await docClient.send(putCommand);

		// Copy before stripping keys - initialTeam is the same object
		// referenced by putCommand.input.Item, and removeKeys mutates in place.
		const responseTeam = { ...initialTeam };
		removeKeys(responseTeam);

		const response: CreateTeamResponse = {
			success: true,
			data: responseTeam,
		};

		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error creating team:", err);
		const response: CreateTeamResponse = {
			success: false,
			error: err.message || "Failed to create team",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
