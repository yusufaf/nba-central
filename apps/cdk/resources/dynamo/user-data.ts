import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export type StoredItem = Record<string, unknown> & { PK: string; SK: string };

export const userPartitionKey = (userUUID: string) => `userUUID#${userUUID}`;

// What each SK prefix under a user's partition holds, as named in the
// export. The export and the delete both read the whole partition rather
// than these prefixes, so an item of a kind not listed here is still
// exported (under `other`) and still deleted.
export const USER_ITEM_KINDS = {
	"team#": "teams",
	"customCoach#": "customCoaches",
	"customGM#": "customGMs",
	"customPlayer#": "customPlayers",
	"customArena#": "customArenas",
} as const;

export type UserItemKind = (typeof USER_ITEM_KINDS)[keyof typeof USER_ITEM_KINDS];

export const itemKind = (sk: string): UserItemKind | null => {
	const prefix = Object.keys(USER_ITEM_KINDS).find((p) => sk.startsWith(p));
	return prefix ? USER_ITEM_KINDS[prefix as keyof typeof USER_ITEM_KINDS] : null;
};

/**
 * Every item under `userUUID#<sub>` in one table. A Query page stops at
 * 1 MB, so this follows LastEvaluatedKey to the end.
 */
export const queryUserPartition = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	userUUID: string,
	projection?: { expression: string; names?: Record<string, string> },
): Promise<StoredItem[]> => {
	const items: StoredItem[] = [];
	let startKey: Record<string, unknown> | undefined;
	do {
		const page = await docClient.send(
			new QueryCommand({
				TableName: tableName,
				KeyConditionExpression: "PK = :pk",
				ExpressionAttributeValues: { ":pk": userPartitionKey(userUUID) },
				ProjectionExpression: projection?.expression,
				ExpressionAttributeNames: projection?.names,
				ExclusiveStartKey: startKey,
			}),
		);
		items.push(...((page.Items ?? []) as StoredItem[]));
		startKey = page.LastEvaluatedKey;
	} while (startKey);
	return items;
};
