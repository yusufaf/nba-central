// Shared by uploadAvatar and uploadArenaImage: an image arrives as base64 in
// a JSON body and is stored in the assets bucket behind the CDN.

export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_IMAGE_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;

// The CDN caches each object for a year, so a replaced image gets a new,
// timestamped key rather than an invalidation.
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type ImageType = { ext: string; contentType: string };

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
	bytes.length >= offset + signature.length &&
	signature.every((byte, i) => bytes[offset + i] === byte);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

// The type comes from the file's own signature, never from a name or a
// Content-Type the client sends. GIF (animation) and SVG (script) are left
// out on purpose.
export const detectImageType = (bytes: Buffer): ImageType | null => {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return { ext: "png", contentType: "image/png" };
	}
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
		return { ext: "jpg", contentType: "image/jpeg" };
	}
	if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
		return { ext: "webp", contentType: "image/webp" };
	}
	return null;
};
