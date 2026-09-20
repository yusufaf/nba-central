import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { PublicTeam, SavedTeam } from "models/api/teams-api";

// Saved teams live under the owner's PK (userUUID#…). The PK2 GSI gives a
// second entry point keyed by the team alone, which is what an anonymous
// reader has. SK2 doubles as the visibility flag so the public query can
// filter at the key level rather than reading private rows and dropping
// them afterwards.
export const teamGsiKey = (teamUUID: string): string => `team#${teamUUID}`;
export const PUBLIC_SK2 = "public";
export const PRIVATE_SK2 = "private";

type StoredTeam = SavedTeam & {
	PK?: string;
	SK?: string;
	PK2?: string;
	SK2?: string;
};

// Strips the table keys and the owner-only fields. `username` stays: it is
// the attribution the share loop is built on.
export const toPublicTeam = (item: StoredTeam): PublicTeam => {
	const {
		PK: _pk,
		SK: _sk,
		PK2: _pk2,
		SK2: _sk2,
		userUUID: _userUUID,
		favorited: _favorited,
		label: _label,
		lastViewed: _lastViewed,
		...rest
	} = item;
	return rest;
};

export const queryPublicTeam = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	teamUUID: string,
): Promise<PublicTeam | null> => {
	const result = await docClient.send(
		new QueryCommand({
			TableName: tableName,
			IndexName: "PK2",
			KeyConditionExpression: "PK2 = :pk2 AND SK2 = :sk2",
			ExpressionAttributeValues: {
				":pk2": teamGsiKey(teamUUID),
				":sk2": PUBLIC_SK2,
			},
			Limit: 1,
		}),
	);
	const item = result.Items?.[0] as StoredTeam | undefined;
	return item ? toPublicTeam(item) : null;
};
