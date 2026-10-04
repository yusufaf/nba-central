import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AuthorizerContext } from "models/auth";
import { CustomArenaItem } from "models/custom-entities";
import { UpdateCustomArenaResponse } from "models/api/custom-entities-api";
import { toArenaFields, validateArenaData } from "utilities/custom-entities-validation";
import { parseRequestBody } from "utilities/request-body";
import { customArenaKey, toArenaListItem } from "resources/dynamo/arenas";

const { mainTable = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: UpdateCustomArenaResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		return fail(401, "Unauthorized");
	}

	const parsed = parseRequestBody<{ arenaUUID: string }>(event.body, { arenaUUID: "string" });
	if (!parsed.valid) {
		return fail(400, parsed.error);
	}
	const validation = validateArenaData(parsed.body);
	if (!validation.valid) {
		return fail(400, validation.error!);
	}
	const fields = toArenaFields(parsed.body);

	try {
		// Keyed by the caller's own partition and conditional on the item
		// existing there, so another user's arenaUUID is a 404, never an
		// edit or a new item. The image fields are left as they are.
		const { Attributes } = await docClient.send(
			new UpdateCommand({
				TableName: mainTable,
				Key: customArenaKey(userUUID, parsed.body.arenaUUID),
				UpdateExpression:
					"SET #updated = :updated, #name = :name, #location = :location, " +
					"#capacity = :capacity, #openedYear = :openedYear, #court = :court",
				ExpressionAttributeNames: {
					"#updated": "updated",
					"#name": "name",
					"#location": "location",
					"#capacity": "capacity",
					"#openedYear": "openedYear",
					"#court": "court",
				},
				ExpressionAttributeValues: {
					":updated": new Date().toISOString(),
					":name": fields.name,
					":location": fields.location,
					":capacity": fields.capacity,
					":openedYear": fields.openedYear,
					":court": fields.court,
				},
				ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
				ReturnValues: "ALL_NEW",
			}),
		);
		if (!Attributes) {
			throw new Error("Update returned no attributes");
		}

		const response: UpdateCustomArenaResponse = {
			success: true,
			data: toArenaListItem(Attributes as CustomArenaItem),
		};
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err) {
		if ((err as Error).name === "ConditionalCheckFailedException") {
			return fail(404, "Arena not found or not owned by user");
		}
		console.error("Error updating arena:", err);
		return fail(500, "Failed to update arena");
	}
};
