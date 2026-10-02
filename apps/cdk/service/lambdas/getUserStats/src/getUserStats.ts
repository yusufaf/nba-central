import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	QueryCommand,
	QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { GetUserStatsResponse } from "models/api/user-profile-api";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const prefixQuery = (userUUID: string, prefix: string): QueryCommandInput => ({
	TableName: mainTable,
	KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
	ExpressionAttributeValues: { ":pk": `userUUID#${userUUID}`, ":sk": prefix },
});

// A Query reads at most 1 MB per page, and that limit applies to COUNT too,
// so every count follows LastEvaluatedKey to the end.
const countItems = async (userUUID: string, prefix: string) => {
	let count = 0;
	let startKey: Record<string, unknown> | undefined;
	do {
		const page = await docClient.send(
			new QueryCommand({
				...prefixQuery(userUUID, prefix),
				Select: "COUNT",
				ExclusiveStartKey: startKey,
			}),
		);
		count += page.Count ?? 0;
		startKey = page.LastEvaluatedKey;
	} while (startKey);
	return count;
};

// One pass over the teams gives both counts: every team, and the published
// ones. Only the flag comes back, not the rosters.
const countTeams = async (userUUID: string) => {
	let teams = 0;
	let publishedTeams = 0;
	let startKey: Record<string, unknown> | undefined;
	do {
		const page = await docClient.send(
			new QueryCommand({
				...prefixQuery(userUUID, "team#"),
				ProjectionExpression: "#pub",
				ExpressionAttributeNames: { "#pub": "public" },
				ExclusiveStartKey: startKey,
			}),
		);
		for (const item of page.Items ?? []) {
			teams++;
			if (item.public === true) publishedTeams++;
		}
		startKey = page.LastEvaluatedKey;
	} while (startKey);
	return { teams, publishedTeams };
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	// Counts are of the authorizer's user only — never an id from the
	// request.
	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		const response: GetUserStatsResponse = {
			success: false,
			error: "Unauthorized",
		};
		return { statusCode: 401, body: JSON.stringify(response) };
	}

	try {
		const [{ teams, publishedTeams }, customCoaches, customGMs, customPlayers] =
			await Promise.all([
				countTeams(userUUID),
				countItems(userUUID, "customCoach#"),
				countItems(userUUID, "customGM#"),
				countItems(userUUID, "customPlayer#"),
			]);

		const response: GetUserStatsResponse = {
			success: true,
			data: { teams, publishedTeams, customCoaches, customGMs, customPlayers },
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		console.error("Error counting user items:", err);
		const response: GetUserStatsResponse = {
			success: false,
			error: (err instanceof Error && err.message) || "Failed to get stats",
		};
		return { statusCode: 500, body: JSON.stringify(response) };
	}
};
