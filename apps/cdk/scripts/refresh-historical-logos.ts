/**
 * Regenerates nba-central's checked-in historicalLogos.json by crawling every
 * NBA/BAA/ABA franchise Basketball-Reference tracks, hashing its
 * season-by-season logo images to collapse ~1,700 team-seasons into a few
 * hundred distinct logo eras, and uploading one keyed-out PNG per era to the
 * assets S3 bucket that TeamBuilderAssetsCdn fronts with CloudFront.
 *
 *   pnpm run refresh-historical-logos
 *   pnpm run refresh-historical-logos -- --check    # verify only, upload/write nothing
 *
 * The images are NOT checked into the repo - same model as
 * refresh-historical-jerseys.ts and upload-hero-video.ts. Each row's `logo`
 * is the full CDN URL; the S3 key is content-hashed (see logoObjectKey in
 * lib/historicalLogos.ts), so an era whose bytes haven't changed is skipped
 * on re-runs and one whose artwork did change gets a fresh, never-cached URL.
 *
 * Uploading (i.e. running without --check) requires apps/cdk's .env
 * (account/region/appName/deploymentType - the same ones `cdk deploy` reads)
 * to name the target bucket and locate its CloudFront distribution, plus AWS
 * credentials able to write to that bucket. --check needs neither: it
 * exercises the same crawl, keying, and key-derivation path without touching
 * AWS at all, and leaves `logo` empty.
 *
 * Takes several minutes - BBRef throttles bulk requests, so both the HTML
 * and image fetches are deliberately spaced out.
 */
import * as fs from "fs";
import { createHash } from "crypto";
import { config as dotEnvConfig } from "dotenv";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { setupAssetsCdnUpload, type AssetsCdnUpload } from "./lib/assetsCdn";
import {
	collapseEras,
	logoObjectKey,
	parseFranchiseSeasons,
	parseFranchises,
	parseLogoBase,
	type Era,
	type HashedSeason,
} from "./lib/historicalLogos";
import { keyOutWhiteBackground } from "./lib/pngAlpha";
import {
	dataPath,
	fetchPage,
	isCheckOnly,
	parseOrThrow,
	run,
	sleep,
	writeIfClean,
} from "./lib/refresh";

dotEnvConfig();

const BBREF_BASE_URL = "https://www.basketball-reference.com";
const TEAMS_INDEX_URL = `${BBREF_BASE_URL}/teams/`;

const OUTPUT_PATH = dataPath("historicalLogos.json");

// BBRef 403s a default fetch User-Agent; identify ourselves like the other
// refresh scripts do.
const USER_AGENT =
	"team-builder-refresh-historical-logos/1.0 (https://github.com/; contact via repo)";

// BBRef throttles bulk requests to roughly 20/minute for HTML pages; the
// image CDN is far more permissive but still worth spacing out.
const PAGE_SPACING_MS = 3500;
const IMAGE_SPACING_MS = 150;
const RETRY_LIMIT = 5;

// The BAA's first season ended in 1947; nothing in the dataset should predate
// that or reach further than a couple of seasons past today.
const MIN_YEAR = 1947;
const MAX_YEAR = new Date().getFullYear() + 2;

const REQUIRED_FIELDS: (keyof Era)[] = [
	"franchise",
	"franchiseName",
	"team",
	"name",
	"league",
	"startYear",
	"endYear",
	"years",
];

const fetchWithRetry = async (url: string) => {
	for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
		const response = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
		});
		if (response.status !== 429) {
			return response;
		}
		await sleep(IMAGE_SPACING_MS * 5 * (attempt + 1));
	}
	throw new Error(`${url} kept returning 429 after ${RETRY_LIMIT} retries`);
};

// Uint8Array rather than Buffer throughout this file: node's Buffer types its
// backing store as ArrayBufferLike (Buffer|SharedArrayBuffer), which current
// @types/node + TS no longer accept where a plain Uint8Array is expected.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const isPng = (bytes: Uint8Array) =>
	PNG_MAGIC.every((byte, index) => bytes[index] === byte);

/**
 * Downloads one season's logo. Returns null for a 404 (a handful of early
 * seasons predate BBRef's logo coverage even within a franchise's own
 * year range) and records a problem for anything that responds but doesn't
 * look like a real image.
 */
const fetchLogoImage = async (
	url: string,
	label: string,
	problems: string[],
): Promise<Uint8Array | null> => {
	const response = await fetchWithRetry(url);
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		problems.push(`${label}: image request returned ${response.status}`);
		return null;
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length < 200 || !isPng(bytes)) {
		problems.push(`${label}: response did not look like a PNG`);
		return null;
	}
	return bytes;
};

/**
 * Puts one era's PNG in the assets bucket unless an object already sits at
 * its content-addressed key - identical key means identical bytes, so a
 * re-run skips it instead of stacking versions on the versioned bucket.
 * Returns whether an upload actually happened.
 */
const uploadLogo = async (
	upload: AssetsCdnUpload,
	objectKey: string,
	png: Uint8Array,
): Promise<boolean> => {
	try {
		await upload.s3Client.send(
			new HeadObjectCommand({ Bucket: upload.bucketName, Key: objectKey }),
		);
		return false;
	} catch (err) {
		if ((err as { name?: string }).name !== "NotFound") throw err;
	}
	await upload.s3Client.send(
		new PutObjectCommand({
			Bucket: upload.bucketName,
			Key: objectKey,
			Body: png,
			ContentType: "image/png",
			// The hash in the key is the whole cache-busting mechanism - this
			// object's content never changes at this key, so cache it hard.
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);
	return true;
};

const main = async () => {
	const checkOnly = isCheckOnly();
	const problems: string[] = [];

	// Resolve the bucket and distribution before the multi-minute crawl so a
	// missing .env or expired credentials fail immediately.
	const upload = checkOnly ? null : await setupAssetsCdnUpload();

	const indexBody = await fetchPage(TEAMS_INDEX_URL, USER_AGENT);
	const franchises = parseOrThrow(indexBody, parseFranchises, "franchises");
	if (franchises.length < 40) {
		problems.push(
			`Only ${franchises.length} franchises parsed - expected around 53`,
		);
	} else if (franchises.length > 53) {
		console.warn(
			`Note: ${franchises.length} franchises parsed, more than the 53 on record - new expansion team?`,
		);
	}

	const historicalTeamNames = new Set(
		(
			JSON.parse(
				fs.readFileSync(dataPath("nbaHistoricalTeams.json"), "utf8"),
			) as { name: string }[]
		).map((team) => team.name),
	);

	let logoBase: string | null = null;
	// Bytes for every downloaded (teamCode, year), keyed "CODE-YEAR" - an
	// era's file is always the season that started it, so no re-fetch is
	// needed once collapseEras has grouped everything.
	const imageBytes = new Map<string, Uint8Array>();
	const allEras: Era[] = [];

	for (const [index, franchise] of franchises.entries()) {
		const franchiseUrl = `${BBREF_BASE_URL}/teams/${franchise.code}/`;
		const franchiseBody = await fetchPage(franchiseUrl, USER_AGENT);
		logoBase ??= parseLogoBase(franchiseBody);

		const seasons = parseOrThrow(
			franchiseBody,
			(body) => parseFranchiseSeasons(body, franchise.code),
			`${franchise.name} seasons`,
		).filter((s) => s.year >= franchise.yearMin && s.year <= franchise.yearMax);

		const hashedSeasons: HashedSeason[] = [];
		for (const season of seasons) {
			const key = `${season.teamCode}-${season.year}`;
			const url = `${logoBase}${key}.png`;
			const label = `${franchise.name} ${season.year}`;

			const buffer = await fetchLogoImage(url, label, problems);
			await sleep(IMAGE_SPACING_MS);
			if (!buffer) continue;

			imageBytes.set(key, buffer);
			hashedSeasons.push({
				...season,
				hash: createHash("sha1").update(buffer).digest("hex"),
			});
		}

		allEras.push(...collapseEras(franchise, hashedSeasons));

		console.log(
			`[${index + 1}/${franchises.length}] ${franchise.name}: ${hashedSeasons.length} seasons`,
		);
		if (index < franchises.length - 1) {
			await sleep(PAGE_SPACING_MS);
		}
	}

	let uploaded = 0;
	let unchanged = 0;
	const rows: (Omit<Era, "logoHash"> & { logo: string })[] = [];
	for (const era of allEras) {
			for (const field of REQUIRED_FIELDS) {
				if (era[field] === undefined || era[field] === "") {
					problems.push(`${era.franchise} ${era.years}: missing ${field}`);
				}
			}
			if (era.startYear < MIN_YEAR || era.endYear > MAX_YEAR) {
				problems.push(
					`${era.franchiseName} ${era.years}: year out of range (${MIN_YEAR}-${MAX_YEAR})`,
				);
			}
			if (!historicalTeamNames.has(era.name)) {
				console.warn(
					`Note: "${era.name}" is not in nbaHistoricalTeams.json`,
				);
			}

		const imageKey = `${era.team}-${era.startYear}`;
		const buffer = imageBytes.get(imageKey);
		if (!buffer) {
			problems.push(`${era.franchiseName} ${era.years}: no image downloaded`);
			continue;
		}

		// BBRef serves opaque white backgrounds; key them out so the logos
		// sit on nba-central's dark theme instead of in a white square. The
		// era hash above stays on the source bytes, so this never changes
		// which seasons collapse together. Keying runs under --check too:
		// the object key hashes the keyed bytes, so this is the path that
		// decides each URL.
		const { png, skipped } = keyOutWhiteBackground(buffer);
		if (skipped && skipped !== "no edge-connected white") {
			console.warn(`Note: ${imageKey}.png left opaque (${skipped})`);
		}
		const objectKey = logoObjectKey(imageKey, png);

		let logo = "";
		if (upload) {
			if (await uploadLogo(upload, objectKey, png)) {
				uploaded++;
			} else {
				unchanged++;
			}
			logo = `https://${upload.distributionDomain}/${objectKey}`;
		}

		const { logoHash: _logoHash, ...row } = era;
		rows.push({ ...row, logo });
	}
	rows.sort((a, b) => a.franchise.localeCompare(b.franchise) || a.startYear - b.startYear);

	console.log(
		`${rows.length} logo eras across ${franchises.length} franchises, ${imageBytes.size} season images downloaded` +
			(upload ? `, ${uploaded} uploaded, ${unchanged} already on the CDN` : ""),
	);

	writeIfClean(OUTPUT_PATH, rows, problems, checkOnly);
};

run(main);
