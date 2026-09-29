import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { UpdateUserSettingsResponse } from "models/api/user-settings-api";
import {
	SettingsMap,
	pickValidSettings,
	settingsItemKey,
	validateSettingsPatch,
} from "models/user-settings";

const { usersTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const isConditionFailure = (err: unknown) =>
	err instanceof Error && err.name === "ConditionalCheckFailedException";

// Sets each patched key inside the existing map, so two devices saving
// different fields at once can't overwrite each other. DynamoDB can't SET a
// nested path whose parent map doesn't exist, hence the condition.
const updateKeys = (userUUID: string, patch: SettingsMap, timestamp: string) => {
	const names: Record<string, string> = { "#settings": "settings" };
	const values: Record<string, unknown> = { ":now": timestamp };
	const sets = ["settingsUpdatedAt = :now"];

	Object.entries(patch).forEach(([key, value], index) => {
		names[`#k${index}`] = key;
		values[`:v${index}`] = value;
		sets.push(`#settings.#k${index} = :v${index}`);
	});

	return docClient.send(
		new UpdateCommand({
			TableName: usersTable,
			Key: settingsItemKey(userUUID),
			UpdateExpression: `SET ${sets.join(", ")}`,
			ConditionExpression: "attribute_exists(#settings)",
			ExpressionAttributeNames: names,
			ExpressionAttributeValues: values,
			ReturnValues: "ALL_NEW",
		}),
	);
};

// First write for this user: the patch becomes the whole map.
const createMap = (userUUID: string, patch: SettingsMap, timestamp: string) =>
	docClient.send(
		new UpdateCommand({
			TableName: usersTable,
			Key: settingsItemKey(userUUID),
			UpdateExpression:
				"SET #settings = :settings, settingsUpdatedAt = :now, createdAt = if_not_exists(createdAt, :now)",
			ConditionExpression: "attribute_not_exists(#settings)",
			ExpressionAttributeNames: { "#settings": "settings" },
			ExpressionAttributeValues: { ":settings": patch, ":now": timestamp },
			ReturnValues: "ALL_NEW",
		}),
	);

const writePatch = async (userUUID: string, patch: SettingsMap) => {
	const timestamp = new Date().toISOString();
	try {
		return await updateKeys(userUUID, patch, timestamp);
	} catch (err) {
		if (!isConditionFailure(err)) throw err;
	}
	try {
		return await createMap(userUUID, patch, timestamp);
	} catch (err) {
		// Another request created the map between our two writes.
		if (!isConditionFailure(err)) throw err;
	}
	return updateKeys(userUUID, patch, timestamp);
};

const badRequest = (error: string): APIGatewayProxyResultV2 => {
	const response: UpdateUserSettingsResponse = { success: false, error };
	return { statusCode: 400, body: JSON.stringify(response) };
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	// Only the authorizer's sub decides whose item is written; any user id
	// in the body is ignored.
	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		const response: UpdateUserSettingsResponse = {
			success: false,
			error: "Unauthorized",
		};
		return { statusCode: 401, body: JSON.stringify(response) };
	}

	let body: unknown;
	try {
		body = JSON.parse(event.body ?? "");
	} catch {
		return badRequest("Invalid request body");
	}
	if (typeof body !== "object" || body === null) {
		return badRequest("Invalid request body");
	}

	const validation = validateSettingsPatch(
		(body as { settings?: unknown }).settings,
	);
	if (!validation.valid) {
		return badRequest(validation.error);
	}

	try {
		const { Attributes } = await writePatch(userUUID, validation.patch);

		const response: UpdateUserSettingsResponse = {
			success: true,
			data: {
				settings: pickValidSettings(Attributes?.settings),
				updatedAt: Attributes?.settingsUpdatedAt ?? null,
			},
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		console.error("Error updating user settings:", err);
		const response: UpdateUserSettingsResponse = {
			success: false,
			error: (err instanceof Error && err.message) || "Failed to update settings",
		};
		return { statusCode: 500, body: JSON.stringify(response) };
	}
};
