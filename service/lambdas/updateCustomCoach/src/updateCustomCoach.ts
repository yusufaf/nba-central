import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import {
	UpdateCustomCoachPayload,
	UpdateCustomCoachResponse,
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

	const { sub: userUUID } = event.requestContext.authorizer.lambda;

	try {
		const payload: UpdateCustomCoachPayload = JSON.parse(event.body || "{}");

		if (!payload.coachUUID) {
			const response: UpdateCustomCoachResponse = {
				success: false,
				error: "coachUUID is required",
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const validation = validateCoachData(payload);
		if (!validation.valid) {
			const response: UpdateCustomCoachResponse = {
				success: false,
				error: validation.error!,
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const timestamp = new Date().toISOString();

		const updateCommand = new UpdateCommand({
			TableName: mainTable,
			Key: {
				PK: `userUUID#${userUUID}`,
				SK: `customCoach#${payload.coachUUID}`,
			},
			UpdateExpression: "SET updated = :updated, #name = :name, overallRating = :overallRating, specialty = :specialty",
			ExpressionAttributeNames: {
				"#name": "name",
			},
			ExpressionAttributeValues: {
				":updated": timestamp,
				":name": payload.name.trim(),
				":overallRating": payload.overallRating,
				":specialty": payload.specialty,
			},
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
			ReturnValues: "ALL_NEW",
		});

		const dbResponse = await docClient.send(updateCommand);

		const response: UpdateCustomCoachResponse = {
			success: true,
			data: {
				coachUUID: dbResponse.Attributes?.coachUUID!,
				name: dbResponse.Attributes?.name!,
				overallRating: dbResponse.Attributes?.overallRating!,
				specialty: dbResponse.Attributes?.specialty!,
				updated: dbResponse.Attributes?.updated!,
			},
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error updating Coach:", err);

		if (err.name === "ConditionalCheckFailedException") {
			const response: UpdateCustomCoachResponse = {
				success: false,
				error: "Coach not found or not owned by user",
			};
			return {
				statusCode: 404,
				body: JSON.stringify(response),
			};
		}

		const response: UpdateCustomCoachResponse = {
			success: false,
			error: err.message || "Failed to update Coach",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
