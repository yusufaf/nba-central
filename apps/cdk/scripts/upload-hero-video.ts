/**
 * Uploads apps/web's hero video to the assets S3 bucket behind
 * TeamBuilderAssetsCdn and writes apps/web/src/assets/data/heroMedia.json
 * with the resulting CDN URL - same pattern as historicalJerseys.json.
 *
 *   pnpm run upload-hero-video
 *   pnpm run upload-hero-video -- --check    # validate the local file only, upload nothing
 *
 * The clip used to be Git LFS-tracked and served straight from apps/web's
 * public/ dir, but CI's checkout never fetched LFS objects, so production
 * served the ~130-byte LFS pointer text labeled video/mp4 - the browser's
 * decoder failed silently and the poster just never went away. Moving it off
 * LFS and behind the CDN (the manifest is a real file the build can't get
 * wrong) removes that dependency entirely, and matches how
 * historicalJerseys.json's images are already served.
 *
 * The S3 key is content-hashed (hero-loop.<sha256 prefix>.mp4), so a future
 * re-run that changes the video gets a new URL under CACHING_OPTIMIZED
 * without needing a CloudFront invalidation - same reasoning as any
 * content-hashed build asset.
 */
import * as fs from "fs";
import * as crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { config as dotEnvConfig } from "dotenv";
import { dataPath, isCheckOnly, nbaCentralPath, run } from "./lib/refresh";
import { setupAssetsCdnUpload } from "./lib/assetsCdn";

dotEnvConfig();

const SOURCE_PATH = nbaCentralPath("public/hero/hero-loop.mp4");
const MANIFEST_PATH = dataPath("heroMedia.json");
const HASH_PREFIX_LENGTH = 12;

/** ISO Base Media (mp4/mov/...) starts with a 4-byte size then "ftyp". */
const isMp4 = (bytes: Uint8Array): boolean =>
	bytes.length > 8 &&
	bytes[4] === 0x66 && // f
	bytes[5] === 0x74 && // t
	bytes[6] === 0x79 && // y
	bytes[7] === 0x70; // p

const main = async () => {
	const checkOnly = isCheckOnly();

	if (!fs.existsSync(SOURCE_PATH)) {
		throw new Error(`No hero video at ${SOURCE_PATH}`);
	}
	const bytes = new Uint8Array(fs.readFileSync(SOURCE_PATH));

	if (bytes.length < 1000) {
		// Exactly what a Git LFS pointer looks like if `git lfs pull` was
		// never run for this checkout - a few hundred bytes of text, not a
		// video. Catch it here instead of uploading it as one.
		throw new Error(
			`${SOURCE_PATH} is only ${bytes.length} bytes - looks like an unfetched Git LFS pointer, not a real video. Run "git lfs pull".`,
		);
	}
	if (!isMp4(bytes)) {
		throw new Error(`${SOURCE_PATH} doesn't look like an MP4 (no ftyp box)`);
	}

	const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, HASH_PREFIX_LENGTH);
	const objectKey = `hero/hero-loop.${hash}.mp4`;
	console.log(`hero-loop.mp4: ${bytes.length} bytes, key ${objectKey}`);

	if (checkOnly) {
		console.log("--check passed, nothing uploaded");
		return;
	}

	const upload = await setupAssetsCdnUpload();
	await upload.s3Client.send(
		new PutObjectCommand({
			Bucket: upload.bucketName,
			Key: objectKey,
			Body: bytes,
			ContentType: "video/mp4",
			// The hash is the whole cache-busting mechanism - this object's
			// content never changes at this key, so cache it hard.
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);

	const heroLoopUrl = `https://${upload.distributionDomain}/${objectKey}`;
	fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify({ heroLoop: heroLoopUrl }, null, 4)}\n`, "utf8");
	console.log(`Uploaded and wrote ${MANIFEST_PATH}`);
};

run(main);
