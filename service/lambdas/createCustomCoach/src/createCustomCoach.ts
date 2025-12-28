import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { AuthorizerContext } from "models/auth";
import { CustomCoachItem } from "models/custom-entities";
import {
	CreateCustomCoachPayload,
	CreateCustomCoachResponse,
} from "models/api/custom-entities-api";
import { validateCoachData } from "utilities/custom-entities-validation";

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
		const payload: CreateCustomCoachPayload = JSON.parse(event.body || "{}");

		const validation = validateCoachData(payload);
		if (!validation.valid) {
			const response: CreateCustomCoachResponse = {
				success: false,
				error: validation.error!,
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const coachUUID = randomUUID();
		const timestamp = new Date().toISOString();

		const item: CustomCoachItem = {
			PK: `userUUID#${userUUID}`,
			SK: `customCoach#${coachUUID}`,
			entityType: "customCoach",
			created: timestamp,
			updated: timestamp,
			coachUUID,
			name: payload.name.trim(),
			overallRating: payload.overallRating,
			specialty: payload.specialty,
			createdBy: username,
		};

		const putCommand = new PutCommand({
			TableName: mainTable,
			Item: item,
		});

		await docClient.send(putCommand);

		const response: CreateCustomCoachResponse = {
			success: true,
			data: {
				coachUUID: item.coachUUID,
				name: item.name,
				overallRating: item.overallRating,
				specialty: item.specialty,
				created: item.created,
			},
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error creating Coach:", err);
		const response: CreateCustomCoachResponse = {
			success: false,
			error: err.message || "Failed to create Coach",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
