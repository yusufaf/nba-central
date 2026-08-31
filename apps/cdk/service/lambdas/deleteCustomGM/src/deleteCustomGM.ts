import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { DeleteCustomGMResponse } from "models/api/custom-entities-api";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const { sub: userUUID } = event.requestContext.authorizer.lambda;
	const gmUUID = event.pathParameters?.gmUUID || "";

	try {
		if (!gmUUID) {
			const response: DeleteCustomGMResponse = {
				success: false,
				error: "gmUUID is required",
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
				SK: `customGM#${gmUUID}`,
			},
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
		});

		await docClient.send(deleteCommand);

		// `data` is void here, but the discriminated union still requires the
		// key. JSON.stringify drops it, so the wire format is unchanged.
		const response: DeleteCustomGMResponse = {
			success: true,
			data: undefined,
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error deleting GM:", err);

		if (err.name === "ConditionalCheckFailedException") {
			const response: DeleteCustomGMResponse = {
				success: false,
				error: "GM not found or not owned by user",
			};
			return {
				statusCode: 404,
				body: JSON.stringify(response),
			};
		}

		const response: DeleteCustomGMResponse = {
			success: false,
			error: err.message || "Failed to delete GM",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
