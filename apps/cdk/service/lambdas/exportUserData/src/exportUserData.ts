import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { settingsItemKey, SettingsMap } from "models/user-settings";
import {
	ExportedItem,
	ExportUserDataResponse,
	UserDataExport,
} from "models/api/user-data-api";
import { itemKind, queryUserPartition, StoredItem } from "resources/dynamo/user-data";
import { removeKeys } from "resources/dynamo/utilities";

const { mainTable = "", usersTable = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// A synchronous Lambda response tops out at 6 MB, envelope included. A team
// with a full roster is a few KB, so this is well over a thousand teams.
const MAX_RESPONSE_BYTES = 5.5 * 1024 * 1024;

const headers = {
	"Content-Type": "application/json",
	"Cache-Control": "no-store",
};

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: ExportUserDataResponse = { success: false, error };
	return { statusCode, headers, body: JSON.stringify(response) };
};

const toExported = (item: StoredItem): ExportedItem => {
	const copy: Record<string, unknown> = { ...item };
	removeKeys(copy);
	delete copy.userUUID;
	return copy;
};

const optionalString = (value: unknown) => (typeof value === "string" ? value : null);

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	// Everything is read from the authorizer's sub's own partition. No id in
	// the request is ever used.
	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		return fail(401, "Unauthorized");
	}

	try {
		const [items, { Item: userItem }] = await Promise.all([
			queryUserPartition(docClient, mainTable, userUUID),
			docClient.send(
				new GetCommand({ TableName: usersTable, Key: settingsItemKey(userUUID) }),
			),
		]);

		const data: UserDataExport = {
			version: 1,
			exportedAt: new Date().toISOString(),
			user: {
				id: userUUID,
				username: optionalString(event.requestContext.authorizer.lambda.username),
			},
			settings: (userItem?.settings as SettingsMap | undefined) ?? {},
			settingsUpdatedAt: optionalString(userItem?.settingsUpdatedAt),
			avatarUrl: optionalString(userItem?.avatarUrl),
			teams: [],
			customCoaches: [],
			customGMs: [],
			customPlayers: [],
			customArenas: [],
			other: [],
		};
		for (const item of items) {
			data[itemKind(item.SK) ?? "other"].push(toExported(item));
		}

		const response: ExportUserDataResponse = { success: true, data };
		const body = JSON.stringify(response);
		if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
			console.error(`Export for ${userUUID} is ${Buffer.byteLength(body)} bytes`);
			return fail(413, "Your data is too large to export in one file");
		}
		return { statusCode: 200, headers, body };
	} catch (err) {
		console.error("Error exporting user data:", err);
		return fail(500, "Failed to export your data");
	}
};
