import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import {
	UpdateCustomGMPayload,
	UpdateCustomGMResponse,
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

	const { sub: userUUID } = event.requestContext.authorizer.lambda;

	try {
		const payload: UpdateCustomGMPayload = JSON.parse(event.body || "{}");

		if (!payload.gmUUID) {
			const response: UpdateCustomGMResponse = {
				success: false,
				error: "gmUUID is required",
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const validation = validateGMData(payload);
		if (!validation.valid) {
			const response: UpdateCustomGMResponse = {
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
				SK: `customGM#${payload.gmUUID}`,
			},
			UpdateExpression: "SET updated = :updated, #name = :name, teams = :teams",
			ExpressionAttributeNames: {
				"#name": "name",
			},
			ExpressionAttributeValues: {
				":updated": timestamp,
				":name": payload.name.trim(),
				":teams": payload.teams || [],
			},
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
			ReturnValues: "ALL_NEW",
		});

		const dbResponse = await docClient.send(updateCommand);

		const response: UpdateCustomGMResponse = {
			success: true,
			data: {
				gmUUID: dbResponse.Attributes?.gmUUID!,
				name: dbResponse.Attributes?.name!,
				teams: dbResponse.Attributes?.teams!,
				updated: dbResponse.Attributes?.updated!,
			},
		};

		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error updating GM:", err);

		if (err.name === "ConditionalCheckFailedException") {
			const response: UpdateCustomGMResponse = {
				success: false,
				error: "GM not found or not owned by user",
			};
			return {
				statusCode: 404,
				body: JSON.stringify(response),
			};
		}

		const response: UpdateCustomGMResponse = {
			success: false,
			error: err.message || "Failed to update GM",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
