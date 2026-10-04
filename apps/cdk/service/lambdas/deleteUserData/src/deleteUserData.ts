import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	BatchWriteCommand,
	DeleteCommand,
	DynamoDBDocumentClient,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { AuthorizerContext } from "models/auth";
import { settingsItemKey } from "models/user-settings";
import { DeleteUserDataResponse } from "models/api/user-data-api";
import { PRIVATE_SK2, PUBLIC_SK2 } from "resources/dynamo/teams";
import { queryUserPartition, StoredItem } from "resources/dynamo/user-data";
import {
	chunk,
	deleteKeys,
	invalidateKeys,
	listKeys,
	teamCardsPrefix,
	arenaImagesPrefix,
} from "utilities/assets-objects";
import { CUSTOM_ARENA_SK_PREFIX } from "resources/dynamo/arenas";

/*
 * Deletes everything nba-central stores for the caller: every item under
 * their partition in the main table, their teams' share cards, their
 * avatar and their custom arenas' images in the assets bucket, and their
 * settings item in the users table. Their Logto account is not touched.
 *
 * The order makes any failure safe to retry:
 *   1. Unpublish their public teams, so no public page is left pointing at
 *      a card that's about to go.
 *   2. Delete the S3 objects. Team and arena UUIDs come from their items,
 *      which still exist, so a retry finds the same objects again.
 *   3. Delete the main-table items.
 *   4. Delete the users item last.
 * Every step is a no-op on data that's already gone, so a second run
 * succeeds and deletes nothing.
 *
 * API Gateway stops waiting after 30 seconds, but the Lambda runs on to its
 * own timeout. A very large account may get an error response while the
 * delete still finishes; deleting again then returns success.
 */

const {
	mainTable = "",
	usersTable = "",
	assetsBucket = "",
	assetsDistributionId = "",
	batchRetryBaseMs = "50",
} = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});

const BATCH_WRITE_LIMIT = 25;
const MAX_BATCH_ATTEMPTS = 8;
const CONCURRENCY = 10;

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: DeleteUserDataResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

// Runs `fn` over the items, at most CONCURRENCY at a time.
const forEachLimited = async <T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> => {
	const results: R[] = [];
	for (const group of chunk(items, CONCURRENCY)) {
		results.push(...(await Promise.all(group.map(fn))));
	}
	return results;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTeam = (item: StoredItem) => item.SK.startsWith("team#");
const teamUUIDOf = (item: StoredItem) => item.SK.slice("team#".length);
const isArena = (item: StoredItem) => item.SK.startsWith(CUSTOM_ARENA_SK_PREFIX);
const arenaUUIDOf = (item: StoredItem) => item.SK.slice(CUSTOM_ARENA_SK_PREFIX.length);

const unpublish = async (item: StoredItem) => {
	try {
		await docClient.send(
			new UpdateCommand({
				TableName: mainTable,
				Key: { PK: item.PK, SK: item.SK },
				UpdateExpression: "SET #pub = :false, SK2 = :private REMOVE cardUrl",
				// UpdateItem would otherwise create the item if it's gone.
				ConditionExpression: "attribute_exists(PK)",
				ExpressionAttributeNames: { "#pub": "public" },
				ExpressionAttributeValues: { ":false": false, ":private": PRIVATE_SK2 },
			}),
		);
	} catch (err) {
		if ((err as Error).name !== "ConditionalCheckFailedException") throw err;
	}
};

type DeleteRequest = { DeleteRequest: { Key: { PK: string; SK: string } } };

// BatchWriteItem can hand back part of a batch as UnprocessedItems when
// throttled; those are retried with backoff until written or out of tries.
const batchDelete = async (items: StoredItem[]) => {
	for (const group of chunk(items, BATCH_WRITE_LIMIT)) {
		let pending: DeleteRequest[] = group.map(({ PK, SK }) => ({
			DeleteRequest: { Key: { PK, SK } },
		}));
		for (let attempt = 0; pending.length > 0; attempt++) {
			if (attempt === MAX_BATCH_ATTEMPTS) {
				throw new Error(`${pending.length} items stayed unprocessed`);
			}
			if (attempt > 0) {
				await sleep(Math.min(Number(batchRetryBaseMs) * 2 ** (attempt - 1), 2000));
			}
			const { UnprocessedItems } = await docClient.send(
				new BatchWriteCommand({ RequestItems: { [mainTable]: pending } }),
			);
			pending = (UnprocessedItems?.[mainTable] ?? []) as DeleteRequest[];
		}
	}
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	// Only the authorizer's sub decides what is deleted. The route takes no
	// body or path id, and anything sent is ignored.
	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		return fail(401, "Unauthorized");
	}

	try {
		const items = await queryUserPartition(docClient, mainTable, userUUID, {
			expression: "PK, SK, SK2, #pub",
			names: { "#pub": "public" },
		});
		const teams = items.filter(isTeam);

		await forEachLimited(
			teams.filter((item) => item.public === true || item.SK2 === PUBLIC_SK2),
			unpublish,
		);

		const prefixes = [
			...teams.map((item) => teamCardsPrefix(teamUUIDOf(item))),
			...items.filter(isArena).map((item) => arenaImagesPrefix(arenaUUIDOf(item))),
			`avatars/${userUUID}/`,
		];
		const keys = (
			await forEachLimited(prefixes, (prefix) => listKeys(s3Client, assetsBucket, prefix))
		).flat();
		await deleteKeys(s3Client, assetsBucket, keys);
		await invalidateKeys(
			cloudFrontClient,
			assetsDistributionId,
			keys,
			`delete-user-data-${userUUID}`,
		);

		await batchDelete(items);

		const { Attributes: userItem } = await docClient.send(
			new DeleteCommand({
				TableName: usersTable,
				Key: settingsItemKey(userUUID),
				ReturnValues: "ALL_OLD",
			}),
		);

		const response: DeleteUserDataResponse = {
			success: true,
			data: {
				deletedItems: items.length + (userItem ? 1 : 0),
				deletedFiles: keys.length,
			},
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		console.error("Error deleting user data:", err);
		return fail(500, "Failed to delete your data");
	}
};
