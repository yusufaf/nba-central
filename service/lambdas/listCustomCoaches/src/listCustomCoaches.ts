import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { ListCustomCoachesResponse } from "models/api/custom-entities-api";

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
				":sk": "customCoach#",
			},
		});

		const dbResponse = await docClient.send(queryCommand);

		const customCoaches = (dbResponse.Items || []).map((item: any) => ({
			coachUUID: item.coachUUID,
			name: item.name,
			overallRating: item.overallRating,
			specialty: item.specialty,
			created: item.created,
			isCustom: true as const,
		}));

		const response: ListCustomCoachesResponse = {
			success: true,
			data: { customCoaches },
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error listing Coaches:", err);
		const response: ListCustomCoachesResponse = {
			success: false,
			error: err.message || "Failed to list Coaches",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
