import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const { MAIN_TABLE_NAME = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event, context): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const params = {
			TableName: MAIN_TABLE_NAME,
			KeyConditionExpression: "PK = :pk",
			ExpressionAttributeValues: {
				":pk": "NEWS",
			},
			ScanIndexForward: false,
			Limit: 100,
		};

		const { Items } = await docClient.send(new QueryCommand(params));

		const articles = (Items || []).map((item) => {
			const { PK, SK, ttl, ...article } = item;
			return article;
		});

		return {
			statusCode: 200,
			body: JSON.stringify(articles),
		};
	} catch (err) {
		console.error("DynamoDB Query Error", err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch news" }),
		};
	}
};
