import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import { UploadAvatarResponse } from "models/api/user-profile-api";
import { settingsItemKey } from "models/user-settings";
import {
	detectImageType,
	IMMUTABLE_CACHE_CONTROL,
	MAX_IMAGE_BASE64_LENGTH,
	MAX_IMAGE_BYTES,
} from "utilities/image-upload";

const { usersTable = "", assetsBucket = "", assetsCdnDomain = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

// The web client sends a 256px square it resized itself, typically well under
// 100 KB. The 1 MB cap (MAX_IMAGE_BYTES) is for any other caller.

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: UploadAvatarResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

const parseImage = (raw: string | null | undefined): string | null => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw ?? "");
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const { image } = parsed as Record<string, unknown>;
	return typeof image === "string" && image ? image : null;
};

const deleteObject = (Key: string) =>
	s3Client.send(new DeleteObjectCommand({ Bucket: assetsBucket, Key }));

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event: { ...event, body: "<omitted>" }, context }, null, 4));

	// The object key and the item are both built from the authorizer's sub
	// alone, so a caller can only ever replace their own avatar. Any user id
	// or key in the body is ignored.
	const userUUID = event.requestContext.authorizer?.lambda?.sub;
	if (!userUUID) {
		return fail(401, "Unauthorized");
	}

	const image = parseImage(event.body);
	if (!image) {
		return fail(400, "image (base64 string) is required");
	}
	// Checked before decoding, so an oversize body isn't copied again.
	if (image.length > MAX_IMAGE_BASE64_LENGTH) {
		return fail(400, "Avatar must be under 1 MB");
	}
	const bytes = Buffer.from(image, "base64");
	if (bytes.length > MAX_IMAGE_BYTES) {
		return fail(400, "Avatar must be under 1 MB");
	}
	const type = detectImageType(bytes);
	if (!type) {
		return fail(400, "Avatar must be a PNG, JPEG or WebP image");
	}

	const prefix = `avatars/${userUUID}/`;
	// Timestamped: see IMMUTABLE_CACHE_CONTROL.
	const objectKey = `${prefix}${Date.now()}.${type.ext}`;
	const avatarUrl = `https://${assetsCdnDomain}/${objectKey}`;

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
		console.error("Error storing avatar:", err);
		return fail(500, "Failed to store avatar");
	}

	let previousKey: unknown;
	try {
		const { Attributes } = await docClient.send(
			new UpdateCommand({
				TableName: usersTable,
				Key: settingsItemKey(userUUID),
				UpdateExpression:
					"SET avatarUrl = :url, avatarKey = :key, avatarUpdatedAt = :now, createdAt = if_not_exists(createdAt, :now)",
				ExpressionAttributeValues: {
					":url": avatarUrl,
					":key": objectKey,
					":now": new Date().toISOString(),
				},
				ReturnValues: "UPDATED_OLD",
			}),
		);
		previousKey = Attributes?.avatarKey;
	} catch (err) {
		console.error("Error recording avatar:", err);
		// Nothing points at the new object; don't leave it behind.
		await deleteObject(objectKey).catch((cleanupErr) =>
			console.error("Error removing unrecorded avatar:", cleanupErr),
		);
		return fail(500, "Failed to save avatar");
	}

	// Only one upload is kept per user. The prefix check is belt and braces:
	// avatarKey is only ever written above.
	if (
		typeof previousKey === "string" &&
		previousKey !== objectKey &&
		previousKey.startsWith(prefix)
	) {
		await deleteObject(previousKey).catch((err) =>
			console.error("Error removing replaced avatar:", err),
		);
	}

	const response: UploadAvatarResponse = { success: true, data: { avatarUrl } };
	return { statusCode: 200, body: JSON.stringify(response) };
};
