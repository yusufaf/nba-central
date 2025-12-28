import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { ListCustomGMsResponse } from "models/api/custom-entities-api";

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
		const queryCommand = new QueryCommand({
			TableName: mainTable,
			KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
			ExpressionAttributeValues: {
				":pk": `userUUID#${userUUID}`,
				":sk": "customGM#",
			},
		});

		const dbResponse = await docClient.send(queryCommand);

		const customGMs = (dbResponse.Items || []).map((item: any) => ({
			gmUUID: item.gmUUID,
			name: item.name,
			teams: item.teams,
			created: item.created,
			isCustom: true as const,
		}));

		const response: ListCustomGMsResponse = {
			success: true,
			data: { customGMs },
		};

		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error listing GMs:", err);
		const response: ListCustomGMsResponse = {
			success: false,
			error: err.message || "Failed to list GMs",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
