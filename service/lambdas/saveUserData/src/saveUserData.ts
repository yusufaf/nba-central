import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.USERS_TABLE_NAME || "";

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	try {
		if (!event.body) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: "Missing request body" }),
			};
		}

		const { clerkUserId: clerkUserID, ...userData } = JSON.parse(
			event.body,
		);

		if (!clerkUserID) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: "Missing clerkUserID" }),
			};
		}

		const timestamp = new Date().toISOString();

		const item = {
			PK: `user#${clerkUserID}`,
			SK: "metadata#",
			clerkUserID,
			...userData,
			createdAt: timestamp,
			updatedAt: timestamp,
		};

		await dynamoDB.send(
			new PutCommand({
				TableName: TABLE_NAME,
				Item: item,
			}),
		);

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "User data saved successfully",
				userData: item,
			}),
		};
	} catch (error) {
		console.error("Error saving user data:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({ message: "Error saving user data" }),
		};
	}
};
