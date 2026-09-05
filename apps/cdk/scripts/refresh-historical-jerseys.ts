/**
 * Regenerates nba-central's checked-in historicalJerseys.json by crawling the
 * Basketball Jersey Database (bballjerseys.com) - a Wix site - and uploading
 * each jersey image to the assets S3 bucket that TeamBuilderAssetsCdn fronts
 * with CloudFront.
 *
 *   pnpm run refresh-historical-jerseys
 *   pnpm run refresh-historical-jerseys -- --check    # verify only, upload/write nothing
 *
 * Unlike historicalLogos.json, the images themselves are NOT checked into the
 * repo: this corpus is a trimmed ~600 home/road and primary-alternate designs
 * (the "special" bucket - throwbacks, City editions, one-off commemoratives -
 * is deliberately dropped, see classifySlot in lib/historicalJerseys.ts), but
 * each is a much heavier watermarked illustration than a keyed-out logo PNG.
 * Only the JSON manifest of CDN URLs is written locally.
 *
 * Uploading (i.e. running without --check) requires apps/cdk's .env
 * (account/region/appName/deploymentType - the same ones `cdk deploy` reads)
 * to name the target bucket and locate its CloudFront distribution, plus AWS
 * credentials able to write to that bucket. --check needs neither: it
 * exercises the same scrape and parse path without touching AWS at all.
 *
 * Takes a while - both bballjerseys.com and Wix's image CDN are fetched once
 * per page/gallery/image, deliberately spaced out.
 */
import * as fs from "fs";
import { config as dotEnvConfig } from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";
import {
	buildParsedJersey,
	extractGalleryIds,
	parseGalleryItems,
	parsePageSlugs,
	parseServerRenderedItems,
	type ParsedJersey,
	type RawGalleryItem,
} from "./lib/historicalJerseys";
import {
	dataPath,
	fetchPage,
	isCheckOnly,
	run,
	sleep,
	writeIfClean,
	type Row,
} from "./lib/refresh";

dotEnvConfig();

const SITE_BASE_URL = "https://www.bballjerseys.com";
const SITEMAP_URL = `${SITE_BASE_URL}/pages-sitemap.xml`;
const TOKENS_URL = `${SITE_BASE_URL}/_api/v1/access-tokens`;

// The Pro Gallery app's own id on this site, read off /_api/v1/access-tokens
// - stable per Wix app install, not per gallery.
const GALLERY_APP_ID = "14271d6f-ba62-d045-549b-ab972ae1f70e";

const OUTPUT_PATH = dataPath("historicalJerseys.json");

// bballjerseys.com 403s a default fetch User-Agent; identify ourselves like
// the other refresh scripts do.
const USER_AGENT =
	"team-builder-refresh-historical-jerseys/1.0 (https://github.com/; contact via repo)";

const PAGE_SPACING_MS = 1500;
const IMAGE_SPACING_MS = 150;
const RETRY_LIMIT = 5;

const MIN_YEAR = 1947;
const MAX_YEAR = new Date().getFullYear() + 2;

// "jersey" (the CDN URL) is deliberately excluded - it only exists after a
// real upload, not under --check - mirroring how refresh-historical-logos.ts
// excludes "logo" from its own required-fields list.
const REQUIRED_FIELDS: (keyof ParsedJersey)[] = [
	"franchiseName",
	"name",
	"league",
	"slot",
	"startYear",
	"endYear",
	"years",
];

const fetchWithRetry = async (url: string, headers: Record<string, string>) => {
	for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
		const response = await fetch(url, { headers });
		if (response.status !== 429) {
			return response;
		}
		await sleep(IMAGE_SPACING_MS * 5 * (attempt + 1));
	}
	throw new Error(`${url} kept returning 429 after ${RETRY_LIMIT} retries`);
};

const fetchInstanceToken = async (): Promise<string> => {
	const response = await fetchWithRetry(TOKENS_URL, { "User-Agent": USER_AGENT });
	if (!response.ok) {
		throw new Error(`${TOKENS_URL} responded ${response.status}`);
	}
	const body: any = await response.json();
	const instance = body?.apps?.[GALLERY_APP_ID]?.instance;
	if (!instance) {
		throw new Error(
			"No Pro Gallery instance token in the access-tokens response - the app id likely changed",
		);
	}
	return instance;
};

const fetchGalleryItems = async (
	galleryId: string,
	instanceToken: string,
): Promise<RawGalleryItem[]> => {
	const url =
		`${SITE_BASE_URL}/pro-gallery-webapp/v1/galleries/${galleryId}` +
		`?galleryId=${galleryId}&offset=0&limit=200&state=PUBLISHED`;
	const response = await fetchWithRetry(url, {
		"User-Agent": USER_AGENT,
		Authorization: instanceToken,
	});
	if (!response.ok) {
		throw new Error(`${url} responded ${response.status}`);
	}
	return parseGalleryItems(await response.text());
};

const loadFranchiseNames = (): Record<string, string> => {
	const rows = JSON.parse(
		fs.readFileSync(dataPath("historicalLogos.json"), "utf8"),
	) as { franchise: string; franchiseName: string }[];
	const names: Record<string, string> = {};
	for (const row of rows) {
		names[row.franchise] = row.franchiseName;
	}
	return names;
};

const isAvif = (bytes: Uint8Array) =>
	bytes.length > 12 && String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp";

/**
 * Downloads one jersey at a fixed 400px width, forcing Wix's AVIF encoder via
 * the Accept header - without it the same URL serves a ~3-8x heavier PNG.
 */
const fetchJerseyImage = async (
	mediaUrl: string,
	label: string,
	problems: string[],
): Promise<Uint8Array | null> => {
	const basename = mediaUrl.split("/").pop();
	const transformUrl = `${mediaUrl}/v1/fit/w_400,h_400,q_85,enc_avif,quality_auto/${basename}`;

	const response = await fetchWithRetry(transformUrl, {
		"User-Agent": USER_AGENT,
		Accept: "image/avif",
	});
	if (!response.ok) {
		problems.push(`${label}: image request returned ${response.status}`);
		return null;
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length < 200 || !isAvif(bytes)) {
		problems.push(`${label}: response did not look like an AVIF image`);
		return null;
	}
	return bytes;
};

/** Wix media ids are globally unique per asset - reused as the S3 key. */
const jerseyKey = (mediaUrl: string): string | null =>
	mediaUrl.match(/\/media\/([a-z0-9_]+)~mv2\.\w+$/i)?.[1] ?? null;

const setupUpload = async () => {
	const { region, appName, deploymentType } = process.env;
	if (!region || !appName || !deploymentType) {
		throw new Error(
			"Uploading requires apps/cdk's .env (region, appName, deploymentType) - see apps/cdk/CLAUDE.md. Pass --check to validate the scrape without uploading.",
		);
	}

	const bucketName = `${appName}-${deploymentType}-assets`;
	const s3Client = new S3Client({ region });

	// CloudFront is a global service fronted by a single us-east-1 API
	// endpoint, regardless of where the origin bucket lives.
	const cloudFrontClient = new CloudFrontClient({ region: "us-east-1" });
	let marker: string | undefined;
	let distribution;
	do {
		const { DistributionList } = await cloudFrontClient.send(
			new ListDistributionsCommand({ Marker: marker }),
		);
		distribution = DistributionList?.Items?.find((item) =>
			item.Origins?.Items?.some((origin) => origin.DomainName?.startsWith(`${bucketName}.s3.`)),
		);
		marker = DistributionList?.IsTruncated ? DistributionList?.NextMarker : undefined;
	} while (!distribution && marker);
	if (!distribution?.DomainName) {
		throw new Error(
			`No CloudFront distribution found fronting ${bucketName} - deploy TeamBuilderAssetsCdn first (cdk deploy)`,
		);
	}

	return { s3Client, bucketName, distributionDomain: distribution.DomainName };
};

const main = async () => {
	const checkOnly = isCheckOnly();
	const problems: string[] = [];
	const franchiseNames = loadFranchiseNames();

	const sitemapBody = await fetchPage(SITEMAP_URL, USER_AGENT);
	const slugs = parsePageSlugs(sitemapBody);
	if (slugs.length === 0) {
		throw new Error("No jersey pages parsed - the sitemap layout likely changed");
	}
	console.log(`Parsed ${slugs.length} jersey pages`);
	if (slugs.length < 40) {
		problems.push(`Only ${slugs.length} jersey pages parsed - expected around 42`);
	}

	const instanceToken = await fetchInstanceToken();
	const upload = checkOnly ? null : await setupUpload();

	const collected: (ParsedJersey & { mediaUrl: string })[] = [];

	for (const [index, slug] of slugs.entries()) {
		const pageUrl = `${SITE_BASE_URL}/${slug}`;
		const pageHtml = await fetchPage(pageUrl, USER_AGENT);

		let rawItems: RawGalleryItem[] = [];
		for (const galleryId of extractGalleryIds(pageHtml)) {
			rawItems.push(...(await fetchGalleryItems(galleryId, instanceToken)));
			await sleep(IMAGE_SPACING_MS);
		}

		// Celtics/Thunder-shaped page: the Pro Gallery API has migrated away
		// to nothing, but Wix still server-renders the same gallery markup
		// into the page HTML - recover an equivalent item list from that.
		if (rawItems.length === 0) {
			rawItems = parseServerRenderedItems(pageHtml);
		}
		if (rawItems.length === 0) {
			problems.push(`${slug}: no jersey items found via the API or server-rendered markup`);
		}

		for (const item of rawItems) {
			const parsed = buildParsedJersey(item, slug, franchiseNames, problems);
			if (!parsed) continue;
			// Trimmed corpus, per the plan's decision: home/road and primary
			// alternates only - "special" is everything classifySlot could
			// not place in either (throwbacks, City/Christmas/commemorative
			// one-offs). All-Star jerseys are exempted: the user explicitly
			// asked for these, and classifySlot has no home/road/alternate
			// signal to key off in an All-Star jersey's title, so every one
			// of them would otherwise be classified "special" and dropped.
			if (parsed.slot === "special" && parsed.league !== "All-Star") continue;
			collected.push({ ...parsed, mediaUrl: item.mediaUrl });
		}

		console.log(`[${index + 1}/${slugs.length}] ${slug}: ${rawItems.length} items`);
		if (index < slugs.length - 1) {
			await sleep(PAGE_SPACING_MS);
		}
	}

	const rows: Row[] = [];
	for (const row of collected) {
		for (const field of REQUIRED_FIELDS) {
			if (row[field] === undefined || row[field] === "") {
				problems.push(`${row.name || row.mediaUrl}: missing ${field}`);
			}
		}
		if (row.startYear < MIN_YEAR || row.endYear > MAX_YEAR) {
			problems.push(`${row.name}: year out of range (${MIN_YEAR}-${MAX_YEAR})`);
		}
		if (!row.franchise && row.league !== "All-Star") {
			console.warn(`Note: "${row.name}" has no franchise join`);
		}

		const key = jerseyKey(row.mediaUrl);
		if (!key) {
			problems.push(`${row.name}: could not derive a storage key from ${row.mediaUrl}`);
			continue;
		}

		// Fetched (and validated) in both modes - this is --check's actual
		// value, confirming Wix's image pipeline still behaves as expected -
		// but only uploaded and kept when actually writing output.
		const bytes = await fetchJerseyImage(row.mediaUrl, row.name, problems);
		await sleep(IMAGE_SPACING_MS);
		if (!bytes) continue;

		let jerseyUrl = "";
		if (upload) {
			await upload.s3Client.send(
				new PutObjectCommand({
					Bucket: upload.bucketName,
					Key: `jerseys/historical/${key}.avif`,
					Body: bytes,
					ContentType: "image/avif",
				}),
			);
			jerseyUrl = `https://${upload.distributionDomain}/jerseys/historical/${key}.avif`;
		}

		const { mediaUrl: _mediaUrl, ...cleanRow } = row;
		rows.push({ ...cleanRow, jersey: jerseyUrl });
	}

	console.log(`${rows.length} jerseys across ${slugs.length} pages`);
	writeIfClean(OUTPUT_PATH, rows, problems, checkOnly);
};

run(main);
