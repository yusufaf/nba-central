import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { AuthorizerContext } from "models/auth";
import { CustomPlayerItem } from "models/custom-entities";
import {
	CreateCustomPlayerPayload,
	CreateCustomPlayerResponse,
} from "models/api/custom-entities-api";
import { validatePlayerData } from "utilities/custom-entities-validation";

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
		const payload: CreateCustomPlayerPayload = JSON.parse(event.body || "{}");

		const validation = validatePlayerData(payload);
		if (!validation.valid) {
			const response: CreateCustomPlayerResponse = {
				success: false,
				error: validation.error!,
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const playerUUID = randomUUID();
		const timestamp = new Date().toISOString();

		const item: CustomPlayerItem = {
			PK: `userUUID#${userUUID}`,
			SK: `customPlayer#${playerUUID}`,
			entityType: "customPlayer",
			created: timestamp,
			updated: timestamp,
			playerUUID,
			name: payload.name.trim(),
			position: payload.position,
			heightFeet: payload.heightFeet,
			heightInches: payload.heightInches,
			weightPounds: payload.weightPounds,
			overallRating: payload.overallRating,
			createdBy: username,
		};

		const putCommand = new PutCommand({
			TableName: mainTable,
			Item: item,
		});

		await docClient.send(putCommand);

		const response: CreateCustomPlayerResponse = {
			success: true,
			data: {
				playerUUID: item.playerUUID,
				name: item.name,
				position: item.position,
				heightFeet: item.heightFeet,
				heightInches: item.heightInches,
				weightPounds: item.weightPounds,
				overallRating: item.overallRating,
				created: item.created,
			},
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error creating Player:", err);
		const response: CreateCustomPlayerResponse = {
			success: false,
			error: err.message || "Failed to create Player",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
