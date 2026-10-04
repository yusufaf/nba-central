import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import { ARENA_IMAGE_SLOTS, ArenaImageSlot } from "models/custom-entities";
import { UploadArenaImageResponse } from "models/api/custom-entities-api";
import { customArenaKey, getCustomArena } from "resources/dynamo/arenas";
import { arenaImagesPrefix } from "utilities/assets-objects";
import {
	detectImageType,
	IMMUTABLE_CACHE_CONTROL,
	MAX_IMAGE_BASE64_LENGTH,
	MAX_IMAGE_BYTES,
} from "utilities/image-upload";
import { parseRequestBody } from "utilities/request-body";

const { mainTable = "", assetsBucket = "", assetsCdnDomain = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

const SLOT_LABELS: Record<ArenaImageSlot, string> = {
	photo: "Photo",
	logo: "Logo",
	drawing: "Drawing",
};

const isSlot = (value: string): value is ArenaImageSlot =>
	(ARENA_IMAGE_SLOTS as readonly string[]).includes(value);

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: UploadArenaImageResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

const deleteObject = (Key: string) =>
	s3Client.send(new DeleteObjectCommand({ Bucket: assetsBucket, Key }));

/*
 * Stores one image slot (photo, centre logo or court drawing) of the
 * caller's own arena. Validation is the avatar upload's: the type comes from
 * the bytes, and the size is checked before and after decoding.
 */
export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event: { ...event, body: "<omitted>" }, context }, null, 4));

	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		return fail(401, "Unauthorized");
	}
	const arenaUUID = event.pathParameters?.arenaUUID ?? "";
	if (!arenaUUID) {
		return fail(400, "arenaUUID is required");
	}

	const parsed = parseRequestBody<{ slot: string; image: string }>(event.body, {
		slot: "string",
		image: "string",
	});
	if (!parsed.valid) {
		return fail(400, parsed.error);
	}
	const { slot, image } = parsed.body;
	if (!isSlot(slot)) {
		return fail(400, `slot must be one of ${ARENA_IMAGE_SLOTS.join(", ")}`);
	}
	const label = SLOT_LABELS[slot];
	// Checked before decoding, so an oversize body isn't copied again.
	if (image.length > MAX_IMAGE_BASE64_LENGTH) {
		return fail(400, `${label} must be under 1 MB`);
	}
	const bytes = Buffer.from(image, "base64");
	if (bytes.length > MAX_IMAGE_BYTES) {
		return fail(400, `${label} must be under 1 MB`);
	}
	const type = detectImageType(bytes);
	if (!type) {
		return fail(400, `${label} must be a PNG, JPEG or WebP image`);
	}
	// The drawing is ink on a transparent layer over the court. A JPEG has
	// no alpha and would cover the whole floor.
	if (slot === "drawing" && type.ext !== "png") {
		return fail(400, `${label} must be a PNG image`);
	}

	// Ownership first: a guessed arenaUUID can't write into someone else's
	// prefix, because the item has to be in the caller's own partition.
	let arenaFound: boolean;
	try {
		arenaFound = !!(await getCustomArena(docClient, mainTable, userUUID, arenaUUID));
	} catch (err) {
		console.error("Error reading arena:", err);
		return fail(500, `Failed to store ${label.toLowerCase()}`);
	}
	if (!arenaFound) {
		return fail(404, "Arena not found or not owned by user");
	}

	const prefix = arenaImagesPrefix(arenaUUID);
	const objectKey = `${prefix}${slot}-${Date.now()}.${type.ext}`;
	const url = `https://${assetsCdnDomain}/${objectKey}`;

	try {
		await s3Client.send(
			new PutObjectCommand({
				Bucket: assetsBucket,
				Key: objectKey,
				Body: bytes,
				ContentType: type.contentType,
				CacheControl: IMMUTABLE_CACHE_CONTROL,
			}),
		);
	} catch (err) {
		console.error("Error storing arena image:", err);
		return fail(500, `Failed to store ${label.toLowerCase()}`);
	}

	let previousKey: unknown;
	try {
		const { Attributes } = await docClient.send(
			new UpdateCommand({
				TableName: mainTable,
				Key: customArenaKey(userUUID, arenaUUID),
				UpdateExpression: "SET #url = :url, #key = :key, #updated = :updated",
				ExpressionAttributeNames: {
					"#url": `${slot}Url`,
					"#key": `${slot}Key`,
					"#updated": "updated",
				},
				ExpressionAttributeValues: {
					":url": url,
					":key": objectKey,
					":updated": new Date().toISOString(),
				},
				// Deleted since the check above: don't recreate a bare item.
				ConditionExpression: "attribute_exists(PK)",
				ReturnValues: "UPDATED_OLD",
			}),
		);
		previousKey = Attributes?.[`${slot}Key`];
	} catch (err) {
		// Nothing points at the new object; don't leave it behind.
		await deleteObject(objectKey).catch((cleanupErr) =>
			console.error("Error removing unrecorded arena image:", cleanupErr),
		);
		if ((err as Error).name === "ConditionalCheckFailedException") {
			return fail(404, "Arena not found or not owned by user");
		}
		console.error("Error recording arena image:", err);
		return fail(500, `Failed to save ${label.toLowerCase()}`);
	}

	// One object per slot. The old URL isn't referenced any more, so it isn't
	// invalidated (the avatar precedent).
	if (
		typeof previousKey === "string" &&
		previousKey !== objectKey &&
		previousKey.startsWith(prefix)
	) {
		await deleteObject(previousKey).catch((err) =>
			console.error("Error removing replaced arena image:", err),
		);
	}

	const response: UploadArenaImageResponse = { success: true, data: { url } };
	return { statusCode: 200, body: JSON.stringify(response) };
};
