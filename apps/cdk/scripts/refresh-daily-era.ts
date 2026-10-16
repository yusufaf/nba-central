/**
 * Builds the Daily Era puzzle images and appends them to the puzzle list.
 *
 *   pnpm run refresh-daily-era -- --check    # build and review, upload nothing
 *   pnpm run refresh-daily-era               # upload new puzzles
 *
 * Reads the home/road jerseys in historicalJerseys.json, downloads each image
 * from the assets CDN, crops away everything that names the answer (year
 * labels, watermark, era caption, handle - see lib/dailyEraImage.ts), merges
 * look-alike jerseys into one puzzle, frames each crop with uneven margins and
 * re-encodes it as WebP. The gallery's own images and URLs are never touched.
 *
 * Every run writes a contact sheet to apps/cdk/daily-era-review/index.html.
 * Review the one from --check before a real run: it shows every crop to be
 * published, every excluded group and every dropped image, with the reason.
 *
 * A real run uploads each new image to the assets bucket under a random key
 * (daily-era/<16 chars>.webp), then writes the list, daily-era-puzzles.json,
 * to the static-data bucket. The list is private and append-only: existing
 * entries keep their place, and the bucket is versioned if a write ever needs
 * undoing. It needs apps/cdk's .env and AWS credentials able to write to both
 * buckets; --check touches no AWS at all and treats the list as empty.
 */
import * as fs from "fs";
import * as path from "path";
import { randomInt } from "node:crypto";
import { config as dotEnvConfig } from "dotenv";
import sharp from "sharp";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { DAILY_ERA_PUZZLES_KEY, type DailyEraPuzzle } from "models/daily-era";
import {
	cropDiffPercent,
	extractCrop,
	findCropBox,
	medianEdgeColour,
	type DropReason,
	type RgbImage,
} from "./lib/dailyEraImage";
import {
	buildGroup,
	buildPuzzleEntry,
	exclusionReason,
	findIdentityCollisions,
	forbiddenIdTokens,
	formatRunLabel,
	groupTwins,
	isPresentRow,
	jerseyIdentity,
	newImageKey,
	newPuzzleId,
	parsePuzzleList,
	planAppend,
	seededShuffle,
	selectPoolRows,
	type PoolRow,
	type PuzzleGroup,
} from "./lib/dailyEraPuzzles";
import { dataPath, isCheckOnly, run } from "./lib/refresh";
import { setupAssetsCdnUpload } from "./lib/assetsCdn";
import { escapeHtml } from "utilities/og-html";

dotEnvConfig();

// Under 1.5% of aligned pixels differ: only small logos or patches change.
// The first truly different design (Heat "HEAT" vs "MIAMI") sits at ~2%.
const TWIN_THRESHOLD = 1.5;
const DAILY_ERA_SHUFFLE_SEED = 174;
// More validation drops than this means the source layout changed.
const MAX_VALIDATION_DROP_SHARE = 0.05;
const REVIEW_DIR = path.resolve(__dirname, "../daily-era-review");

interface Cropped {
	row: PoolRow;
	crop: RgbImage;
	edge: [number, number, number];
}

interface Dropped {
	row: PoolRow;
	reason: DropReason;
}

interface Rendered {
	group: PuzzleGroup;
	webp: Buffer;
}

const readJson = (fileName: string): unknown => JSON.parse(fs.readFileSync(dataPath(fileName), "utf8"));

// `etag` is undefined when nothing is published yet. The final write is
// conditional on it, so a run that overlaps another fails instead of
// dropping that run's entries.
const readPublishedList = async (
	s3Client: S3Client,
	bucket: string,
): Promise<{ puzzles: DailyEraPuzzle[]; etag?: string }> => {
	try {
		const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: DAILY_ERA_PUZZLES_KEY }));
		return {
			puzzles: parsePuzzleList(JSON.parse(await response.Body!.transformToString())),
			etag: response.ETag,
		};
	} catch (err) {
		// Only a missing list means "nothing published yet". Anything else
		// rethrows: treating it as empty would overwrite the append-only list
		// with a fresh, reshuffled one.
		if ((err as Error).name === "NoSuchKey") return { puzzles: [] };
		throw err;
	}
};

const LIST_CHANGED =
	"daily-era-puzzles.json changed since this run read it (another run published) - rerun to build on the new list";

const currentListEtag = async (s3Client: S3Client, bucket: string) => {
	try {
		return (await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: DAILY_ERA_PUZZLES_KEY }))).ETag;
	} catch (err) {
		if ((err as Error).name === "NotFound") return undefined;
		throw err;
	}
};

const cropRow = async (row: PoolRow): Promise<Cropped | Dropped | string> => {
	let buffer: Buffer;
	try {
		const response = await fetch(row.jersey);
		if (!response.ok) return `${row.name}: ${row.jersey} responded ${response.status}`;
		buffer = Buffer.from(await response.arrayBuffer());
	} catch (err) {
		return `${row.name}: fetching ${row.jersey} failed (${(err as Error).message})`;
	}

	let decoded;
	try {
		decoded = await sharp(buffer).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
	} catch (err) {
		return `${row.name}: decoding ${row.jersey} failed (${(err as Error).message})`;
	}
	const { data, info } = decoded;
	if (info.channels !== 3) return `${row.name}: decoded to ${info.channels} channels, expected 3`;

	const img = { data, width: info.width, height: info.height };
	const result = findCropBox(img);
	if (!result.ok) return { row, reason: result.reason };
	return { row, crop: extractCrop(img, result.box), edge: medianEdgeColour(img) };
};

// Two pipelines: within one, sharp always extends after resizing, so the
// margins would land on top of the target width.
const renderPuzzleImage = async ({ crop, edge }: Cropped) => {
	const [r, g, b] = edge;
	const padded = await sharp(crop.data, { raw: { width: crop.width, height: crop.height, channels: 3 } })
		.extend({
			top: randomInt(6, 25),
			bottom: randomInt(6, 25),
			left: randomInt(6, 25),
			right: randomInt(6, 25),
			background: { r, g, b },
		})
		.raw()
		.toBuffer({ resolveWithObject: true });
	const width = randomInt(480, 541);
	const webp = await sharp(padded.data, { raw: padded.info }).resize({ width }).webp({ quality: 82 }).toBuffer();

	const metadata = await sharp(webp).metadata();
	if (metadata.format !== "webp" || metadata.width !== width || !metadata.height) {
		throw new Error(`rendered ${metadata.format} ${metadata.width}x${metadata.height}, expected webp ${width} wide`);
	}
	return webp;
};

interface ContactSheet {
	toPublish: Rendered[];
	excluded: { group: PuzzleGroup; reason: string }[];
	dropped: Dropped[];
	twinsOfPublished: { name: string; puzzleId: string }[];
	crops: Map<string, Cropped>;
}

const writeContactSheet = async (dir: string, sheet: ContactSheet) => {
	fs.rmSync(dir, { recursive: true, force: true });
	fs.mkdirSync(dir, { recursive: true });

	const cropImage = async (row: PoolRow) => {
		const { mediaId } = jerseyIdentity(row);
		const cropped = sheet.crops.get(mediaId)!;
		const file = `${mediaId}.png`;
		await sharp(cropped.crop.data, { raw: { width: cropped.crop.width, height: cropped.crop.height, channels: 3 } })
			.png()
			.toFile(path.join(dir, file));
		return `<img src="${file}" title="${escapeHtml(row.name)}">`;
	};

	const groupCard = async (group: PuzzleGroup, header: string, extra = "") => {
		const members = await Promise.all(group.rows.map(cropImage));
		const names = group.rows.map((row) => escapeHtml(row.name)).join("<br>");
		return `<div class="card">${extra}<div class="crops">${members.join("")}</div><p><b>${escapeHtml(header)}</b><br>${names}</p></div>`;
	};

	const publishCards = await Promise.all(
		sheet.toPublish.map(async ({ group, webp }, i) => {
			const file = `publish-${String(i + 1).padStart(3, "0")}.webp`;
			fs.writeFileSync(path.join(dir, file), webp);
			const label = `#${i + 1} ${formatRunLabel(group.answerSeasons)} (${group.answerSeasons.join(", ")})`;
			return groupCard(group, label, `<img class="puzzle" src="${file}">`);
		}),
	);
	const excludedCards = await Promise.all(sheet.excluded.map(({ group, reason }) => groupCard(group, reason)));
	const droppedCards = sheet.dropped.map(
		({ row, reason }) =>
			`<div class="card"><img class="puzzle" src="${escapeHtml(row.jersey)}"><p><b>${reason}</b><br>${escapeHtml(row.name)}</p></div>`,
	);
	const twinItems = sheet.twinsOfPublished.map(
		({ name, puzzleId }) => `<li>${escapeHtml(name)} - twin of published puzzle ${escapeHtml(puzzleId)}</li>`,
	);

	const section = (title: string, body: string[], wrap = "grid") =>
		`<h2>${title} (${body.length})</h2>${wrap === "list" ? `<ul>${body.join("")}</ul>` : `<div class="grid">${body.join("")}</div>`}`;

	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Daily Era review</title>
<style>
body { font: 14px system-ui, sans-serif; background: #111; color: #eee; margin: 1rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr)); gap: 1rem; }
.card { background: #222; border-radius: 0.5rem; padding: 0.75rem; }
.card img { max-width: 100%; }
.puzzle { display: block; margin-bottom: 0.5rem; }
.crops { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.crops img { width: 10rem; }
</style></head><body>
<h1>Daily Era review</h1>
${section("To publish", publishCards)}
${section("Excluded", excludedCards)}
${section("Dropped", droppedCards)}
${section("Twins of published puzzles", twinItems, "list")}
</body></html>
`;
	fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
	console.log(`Contact sheet: ${path.join(dir, "index.html")}`);
};

const main = async () => {
	const checkOnly = isCheckOnly();
	const problems: string[] = [];

	const pool = selectPoolRows(readJson("historicalJerseys.json") as PoolRow[]);
	console.log(`${pool.length} home/road jerseys in the pool`);
	const collisions = findIdentityCollisions(pool);
	if (collisions.length > 0) {
		// Every later step keys on the media id, so stop here.
		collisions.forEach((problem) => console.error(`  ${problem}`));
		throw new Error("Refusing to build puzzles: jersey media ids are missing or shared");
	}

	const logos = readJson("historicalLogos.json");
	const logoCodes = Array.isArray(logos) ? logos.map((logo) => (logo as { team?: unknown }).team) : [];
	if (!Array.isArray(logos) || logoCodes.some((code) => typeof code !== "string" || !/^[A-Z]{3}$/.test(code))) {
		problems.push("historicalLogos.json: expected an array whose every team is a 3-letter code");
	}
	const forbidden = forbiddenIdTokens(pool, logoCodes.filter((code): code is string => typeof code === "string"));

	let existing: DailyEraPuzzle[] = [];
	let upload: { s3Client: S3Client; assetsBucket: string; staticDataBucket: string; listEtag?: string } | undefined;
	if (checkOnly) {
		console.log("--check: treating the published list as empty");
	} else {
		const { s3Client, bucketName: assetsBucket } = await setupAssetsCdnUpload();
		const staticDataBucket = `${process.env.appName}-${process.env.deploymentType}-static-data`;
		console.log(`Images go to ${assetsBucket}, the list to ${staticDataBucket}/${DAILY_ERA_PUZZLES_KEY}`);
		const published = await readPublishedList(s3Client, staticDataBucket);
		existing = published.puzzles;
		console.log(`${existing.length} puzzles already published`);
		upload = { s3Client, assetsBucket, staticDataBucket, listEtag: published.etag };
	}

	const crops = new Map<string, Cropped>();
	const dropped: Dropped[] = [];
	for (const [i, row] of pool.entries()) {
		const result = await cropRow(row);
		if (typeof result === "string") problems.push(result);
		else if ("reason" in result) dropped.push(result);
		else crops.set(jerseyIdentity(row).mediaId, result);
		if ((i + 1) % 100 === 0) console.log(`  cropped ${i + 1}/${pool.length}`);
	}

	const dropCounts = new Map<string, number>();
	for (const { reason } of dropped) dropCounts.set(reason, (dropCounts.get(reason) ?? 0) + 1);
	const validationDrops = dropped.filter(({ reason }) => reason !== "frame-template").length;
	if (validationDrops > pool.length * MAX_VALIDATION_DROP_SHARE) {
		problems.push(`${validationDrops} images failed crop validation - the source layout probably changed`);
	}

	const groups = groupTwins(
		[...crops.entries()].map(([key, cropped]) => ({ key, franchise: cropped.row.franchise, item: cropped.crop })),
		(a, b) => cropDiffPercent(a, b, TWIN_THRESHOLD) < TWIN_THRESHOLD,
	).map((keys) => buildGroup(keys.map((key) => crops.get(key)!.row)));

	const unsafe = [...pool.filter(isPresentRow), ...dropped.map(({ row }) => row)];
	const kept: PuzzleGroup[] = [];
	const excluded: { group: PuzzleGroup; reason: string }[] = [];
	for (const group of groups) {
		const reason = exclusionReason(group, unsafe);
		if (reason) excluded.push({ group, reason });
		else kept.push(group);
	}

	const plan = planAppend(existing, kept);
	const toPublish: Rendered[] = [];
	for (const group of seededShuffle(plan.toAppend, DAILY_ERA_SHUFFLE_SEED)) {
		try {
			toPublish.push({ group, webp: await renderPuzzleImage(crops.get(jerseyIdentity(group.shown).mediaId)!) });
		} catch (err) {
			problems.push(`${group.shown.name}: ${(err as Error).message}`);
		}
	}

	await writeContactSheet(REVIEW_DIR, {
		toPublish,
		excluded,
		dropped,
		twinsOfPublished: plan.twinsOfPublished.map(({ identity, puzzleId }) => ({ name: identity.name, puzzleId })),
		crops,
	});

	console.log(`Dropped: ${JSON.stringify(Object.fromEntries(dropCounts))}`);
	console.log(
		`${groups.length} groups, ${excluded.length} excluded, ${plan.alreadyPublished} already published, ` +
			`${plan.twinsOfPublished.length} twins of published puzzles, ${toPublish.length} to publish`,
	);

	if (problems.length > 0) {
		console.error(`\n${problems.length} problem(s):`);
		problems.forEach((problem) => console.error(`  ${problem}`));
		throw new Error("Refusing to publish daily era puzzles");
	}

	if (!upload) {
		console.log("--check passed, nothing uploaded");
		return;
	}

	// Cropping takes minutes; catch a run that published meanwhile before
	// uploading anything. The conditional write below closes the rest of the
	// window.
	if ((await currentListEtag(upload.s3Client, upload.staticDataBucket)) !== upload.listEtag) {
		throw new Error(LIST_CHANGED);
	}

	// Images first, so the list never names a key that isn't there yet.
	const newEntries: DailyEraPuzzle[] = [];
	for (const { group, webp } of toPublish) {
		const imageKey = newImageKey(forbidden);
		await upload.s3Client.send(
			new PutObjectCommand({
				Bucket: upload.assetsBucket,
				Key: imageKey,
				Body: webp,
				ContentType: "image/webp",
				CacheControl: "public, max-age=31536000, immutable",
			}),
		);
		newEntries.push(buildPuzzleEntry(group, { puzzleId: newPuzzleId(forbidden), imageKey }));
	}

	try {
		await upload.s3Client.send(
			new PutObjectCommand({
				Bucket: upload.staticDataBucket,
				Key: DAILY_ERA_PUZZLES_KEY,
				Body: `${JSON.stringify([...existing, ...newEntries], null, 4)}\n`,
				ContentType: "application/json",
				...(upload.listEtag ? { IfMatch: upload.listEtag } : { IfNoneMatch: "*" }),
			}),
		);
	} catch (err) {
		// The uploaded images stay unreferenced: harmless, their keys say nothing.
		if ((err as Error).name === "PreconditionFailed") console.error(LIST_CHANGED);
		throw err;
	}
	console.log(`Uploaded ${newEntries.length} puzzles; the list now holds ${existing.length + newEntries.length}`);
};

run(main);
