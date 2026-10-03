import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { AuthorizerContext } from "models/auth";
import { DeleteTeamResponse } from "models/api/teams-api";
import {
	deleteKeys,
	invalidateKeys,
	listKeys,
	teamCardsPrefix,
} from "utilities/assets-objects";

const { mainTable = "", assetsBucket = "", assetsDistributionId = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});

const notOwned = (): APIGatewayProxyResultV2 => {
	const response: DeleteTeamResponse = {
		success: false,
		error: "Team not found or not owned by user",
	};
	return {
		statusCode: 404,
		body: JSON.stringify(response),
	};
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const { sub: userUUID } = event.requestContext.authorizer.lambda;
	const teamUUID = event.pathParameters?.teamUUID || "";

	try {
		if (!teamUUID) {
			const response: DeleteTeamResponse = {
				success: false,
				error: "teamUUID is required",
			};
			return {
				statusCode: 400,
				body: JSON.stringify(response),
			};
		}

		const key = {
			PK: `userUUID#${userUUID}`,
			SK: `team#${teamUUID}`,
		};

		// Ownership first: the cards are keyed by team alone, so they are
		// only touched once the caller is known to own the team.
		const owned = await docClient.send(
			new GetCommand({ TableName: mainTable, Key: key, ProjectionExpression: "teamUUID" }),
		);
		if (!owned.Item) {
			return notOwned();
		}

		// The cards go before the item: once the item is gone nothing leads
		// back to them, and a failure here leaves the item for a retry.
		const cardKeys = await listKeys(s3Client, assetsBucket, teamCardsPrefix(teamUUID));
		await deleteKeys(s3Client, assetsBucket, cardKeys);
		await invalidateKeys(cloudFrontClient, assetsDistributionId, cardKeys, `delete-team-${teamUUID}`);

		const deleteCommand = new DeleteCommand({
			TableName: mainTable,
			Key: key,
			ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
		});

		await docClient.send(deleteCommand);

		const response: DeleteTeamResponse = {
			success: true,
			data: undefined,
		};
		return {
			statusCode: 200,
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error deleting team:", err);

		if (err.name === "ConditionalCheckFailedException") {
			return notOwned();
		}

		const response: DeleteTeamResponse = {
			success: false,
			error: err.message || "Failed to delete team",
		};
		return {
			statusCode: 500,
			body: JSON.stringify(response),
		};
	}
};
