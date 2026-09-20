import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import {
	PublishTeamPayload,
	PublishTeamResponse,
	SavedTeam,
} from "models/api/teams-api";
import { removeKeys } from "resources/dynamo/utilities";
import { PRIVATE_SK2, PUBLIC_SK2, teamGsiKey } from "resources/dynamo/teams";

const { mainTable = "", assetsBucket = "", assetsCdnDomain = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

// API Gateway v2 caps the request at 10 MB; a 1200x630 card is a few hundred
// KB. Anything past this is a bug or abuse, not a bigger card.
const MAX_CARD_BYTES = 2 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: PublishTeamResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

const parsePayload = (raw: string | undefined): PublishTeamPayload | null => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw || "{}");
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const { teamUUID, public: isPublic, cardPng } = parsed as Record<string, unknown>;
	if (typeof teamUUID !== "string" || !teamUUID || teamUUID.includes("/")) return null;
	if (typeof isPublic !== "boolean") return null;
	if (cardPng !== undefined && cardPng !== null && typeof cardPng !== "string") return null;
	return { teamUUID, public: isPublic, cardPng: cardPng as string | null | undefined };
};

const decodeCard = (cardPng: string): Buffer | null => {
	const bytes = Buffer.from(cardPng, "base64");
	if (bytes.length === 0 || bytes.length > MAX_CARD_BYTES) return null;
	if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return null;
	return bytes;
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event: { ...event, body: "<omitted>" }, context }, null, 4));

	const { sub: userUUID } = event.requestContext.authorizer.lambda;

	const payload = parsePayload(event.body);
	if (!payload) {
		return fail(400, "teamUUID (string) and public (boolean) are required");
	}

	const key = { PK: `userUUID#${userUUID}`, SK: `team#${payload.teamUUID}` };

	try {
		// Ownership first, so a caller can't park objects under someone
		// else's team prefix by guessing a UUID — the update below would
		// refuse, but the upload would already have happened.
		const owned = await docClient.send(
			new GetCommand({
				TableName: mainTable,
				Key: key,
				ProjectionExpression: "teamUUID",
			}),
		);
		if (!owned.Item) {
			return fail(404, "Team not found or not owned by user");
		}

		const now = new Date().getTime();
		let cardUrl: string | undefined;

		if (payload.public && payload.cardPng) {
			const bytes = decodeCard(payload.cardPng);
			if (!bytes) {
				return fail(400, "cardPng must be a PNG under 2 MB");
			}
			// Timestamped key: the CDN caches for a year, so a re-save must
			// land on a fresh URL rather than wait out the old one.
			const objectKey = `cards/${payload.teamUUID}/${now}.png`;
			await s3Client.send(
				new PutObjectCommand({
					Bucket: assetsBucket,
					Key: objectKey,
					Body: bytes,
					ContentType: "image/png",
					CacheControl: "public, max-age=31536000, immutable",
				}),
			);
			cardUrl = `https://${assetsCdnDomain}/${objectKey}`;
		}

		const setClauses = [
			"#pub = :pub",
			"PK2 = :pk2",
			"SK2 = :sk2",
			"updatedAt = :now",
			"publishedAt = if_not_exists(publishedAt, :now)",
		];
		const values: Record<string, unknown> = {
			":pub": payload.public,
			":pk2": teamGsiKey(payload.teamUUID),
			":sk2": payload.public ? PUBLIC_SK2 : PRIVATE_SK2,
			":now": now,
		};
		if (cardUrl) {
			setClauses.push("cardUrl = :cardUrl");
			values[":cardUrl"] = cardUrl;
		}

		const updated = await docClient.send(
			new UpdateCommand({
				TableName: mainTable,
				Key: key,
				UpdateExpression: `SET ${setClauses.join(", ")}`,
				ExpressionAttributeNames: { "#pub": "public" },
				ExpressionAttributeValues: values,
				ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
				ReturnValues: "ALL_NEW",
			}),
		);

		const team = updated.Attributes as SavedTeam & { PK?: string; SK?: string };
		removeKeys(team);
		const response: PublishTeamResponse = { success: true, data: team };
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err: any) {
		console.error("Error publishing team:", err);
		if (err.name === "ConditionalCheckFailedException") {
			return fail(404, "Team not found or not owned by user");
		}
		return fail(500, err.message || "Failed to publish team");
	}
};
