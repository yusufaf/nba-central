import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { AuthorizerContext } from "models/auth";
import { CustomGMItem } from "models/custom-entities";
import {
	CreateCustomGMPayload,
	CreateCustomGMResponse,
} from "models/api/custom-entities-api";
import { validateGMData } from "utilities/custom-entities-validation";

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
		const payload: CreateCustomGMPayload = JSON.parse(event.body || "{}");

		const validation = validateGMData(payload);
		if (!validation.valid) {
			const response: CreateCustomGMResponse = {
				success: false,
				error: validation.error!,
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const gmUUID = randomUUID();
		const timestamp = new Date().toISOString();

		const item: CustomGMItem = {
			PK: `userUUID#${userUUID}`,
			SK: `customGM#${gmUUID}`,
			entityType: "customGM",
			created: timestamp,
			updated: timestamp,
			gmUUID,
			name: payload.name.trim(),
			teams: payload.teams || [],
			createdBy: username,
		};

		const putCommand = new PutCommand({
			TableName: mainTable,
			Item: item,
		});

		await docClient.send(putCommand);

		const response: CreateCustomGMResponse = {
			success: true,
			data: {
				gmUUID: item.gmUUID,
				name: item.name,
				teams: item.teams,
				created: item.created,
			},
		};

		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error creating GM:", err);
		const response: CreateCustomGMResponse = {
			success: false,
			error: err.message || "Failed to create GM",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
