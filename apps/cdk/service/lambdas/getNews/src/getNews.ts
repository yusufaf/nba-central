import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const { MAIN_TABLE_NAME = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const NEWS_SOURCES = ["ESPN", "Bluesky", "CBS", "RealGM"];
const PER_SOURCE_LIMIT = 25;

export const handler: Handler = async (event, context): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		// One query per source so a high-volume source cannot claim the whole
		// result window and leave the other filters empty.
		const results = await Promise.all(
			NEWS_SOURCES.map((source) =>
				docClient.send(
					new QueryCommand({
						TableName: MAIN_TABLE_NAME,
						KeyConditionExpression: "PK = :pk",
						ExpressionAttributeValues: {
							":pk": `NEWS#${source}`,
						},
						ScanIndexForward: false,
						Limit: PER_SOURCE_LIMIT,
					}),
				),
			),
		);

		const articles = results
			.flatMap(({ Items }) => Items || [])
			.map((item) => {
				const { PK, SK, ttl, ...article } = item;
				return article;
			})
			.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

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
