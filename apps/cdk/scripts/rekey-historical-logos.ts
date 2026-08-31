/**
 * Rewrites the already-downloaded historical logo PNGs so their white
 * background is transparent, without re-crawling Basketball-Reference.
 *
 *   pnpm run rekey-historical-logos
 *   pnpm run rekey-historical-logos -- --check    # report only, write nothing
 *
 * refresh-historical-logos does the same keying on every image it downloads, but
 * a full refresh walks ~1,700 team-seasons behind a 3.5s-per-page throttle. This
 * applies the transform to the checked-in files in place instead. It is
 * idempotent - an image that already carries transparency is skipped - so it is
 * safe to re-run after a partial pass.
 */
import * as fs from "fs";
import * as path from "path";
import { keyOutWhiteBackground, type KeyOutSkipReason } from "./lib/pngAlpha";
import { isCheckOnly, nbaCentralPath, run } from "./lib/refresh";

const IMAGE_DIR = nbaCentralPath("public/logos/historical");

const main = async () => {
	const checkOnly = isCheckOnly();
	const files = fs
		.readdirSync(IMAGE_DIR)
		.filter((name) => name.endsWith(".png"))
		.sort();

	if (files.length === 0) {
		throw new Error(`No PNGs found in ${IMAGE_DIR}`);
	}

	const skippedReasons = new Map<KeyOutSkipReason, string[]>();
	let rewritten = 0;
	let bytesBefore = 0;
	let bytesAfter = 0;

	for (const file of files) {
		const filePath = path.join(IMAGE_DIR, file);
		const source = new Uint8Array(fs.readFileSync(filePath));
		const { png, clearedPixels, skipped } = keyOutWhiteBackground(source);

		bytesBefore += source.length;
		bytesAfter += png.length;

		if (skipped) {
			const bucket = skippedReasons.get(skipped) ?? [];
			bucket.push(file);
			skippedReasons.set(skipped, bucket);
			continue;
		}

		rewritten++;
		if (!checkOnly) {
			fs.writeFileSync(filePath, png);
		}
		if (clearedPixels === 0) {
			console.warn(`Note: ${file} reported no cleared pixels`);
		}
	}

	console.log(
		`${rewritten}/${files.length} images ${checkOnly ? "would gain" : "gained"} a transparent background`,
	);
	for (const [reason, names] of skippedReasons) {
		console.log(`  skipped (${reason}): ${names.length}`);
		if (reason !== "already has transparency") {
			console.log(`    ${names.join(", ")}`);
		}
	}
	console.log(
		`Total size ${(bytesBefore / 1024).toFixed(0)} KiB -> ${(bytesAfter / 1024).toFixed(0)} KiB`,
	);

	if (checkOnly) {
		console.log("--check passed, nothing written");
	}
};

run(main);
