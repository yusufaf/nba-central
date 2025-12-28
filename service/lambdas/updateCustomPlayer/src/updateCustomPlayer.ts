import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import {
	UpdateCustomPlayerPayload,
	UpdateCustomPlayerResponse,
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

	const { sub: userUUID } = event.requestContext.authorizer.lambda;

	try {
		const payload: UpdateCustomPlayerPayload = JSON.parse(event.body || "{}");

		if (!payload.playerUUID) {
			const response: UpdateCustomPlayerResponse = {
				success: false,
				error: "playerUUID is required",
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const validation = validatePlayerData(payload);
		if (!validation.valid) {
			const response: UpdateCustomPlayerResponse = {
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
				SK: `customPlayer#${payload.playerUUID}`,
			},
			UpdateExpression: "SET updated = :updated, #name = :name, #position = :position, heightFeet = :heightFeet, heightInches = :heightInches, weightPounds = :weightPounds, overallRating = :overallRating",
			ExpressionAttributeNames: {
				"#name": "name",
				"#position": "position",
			},
			ExpressionAttributeValues: {
				":updated": timestamp,
				":name": payload.name.trim(),
				":position": payload.position,
				":heightFeet": payload.heightFeet,
				":heightInches": payload.heightInches,
				":weightPounds": payload.weightPounds,
				":overallRating": payload.overallRating,
			},
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
			ReturnValues: "ALL_NEW",
		});

		const dbResponse = await docClient.send(updateCommand);

		const response: UpdateCustomPlayerResponse = {
			success: true,
			data: {
				playerUUID: dbResponse.Attributes?.playerUUID!,
				name: dbResponse.Attributes?.name!,
				position: dbResponse.Attributes?.position!,
				heightFeet: dbResponse.Attributes?.heightFeet!,
				heightInches: dbResponse.Attributes?.heightInches!,
				weightPounds: dbResponse.Attributes?.weightPounds!,
				overallRating: dbResponse.Attributes?.overallRating!,
				updated: dbResponse.Attributes?.updated!,
			},
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error updating Player:", err);

		if (err.name === "ConditionalCheckFailedException") {
			const response: UpdateCustomPlayerResponse = {
				success: false,
				error: "Player not found or not owned by user",
			};
			return {
				statusCode: 404,
				body: JSON.stringify(response),
			};
		}

		const response: UpdateCustomPlayerResponse = {
			success: false,
			error: err.message || "Failed to update Player",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
