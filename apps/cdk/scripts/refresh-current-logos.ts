/**
 * Regenerates nba-central's checked-in currentTeamLogos.json, the only writer
 * of that file. One request to ESPN's public teams endpoint plus one download
 * per logo (30), each uploaded byte-identical to the assets S3 bucket that
 * TeamBuilderAssetsCdn fronts, under `logos/current/<slug>.<hash>.png`. Rows
 * are `{ name, slug, logo }`, with `logo` the CDN URL, so visitors' browsers
 * never load these images from ESPN. Run by hand when a team rebrands
 * (roughly once a decade) - never from a browser or per user request.
 *
 *   pnpm run refresh-current-logos
 *   pnpm run refresh-current-logos -- --check    # verify only, upload/write nothing
 *
 * Uploading (running without --check) requires apps/cdk's .env to name the
 * target bucket and find its CloudFront distribution, plus AWS credentials
 * able to write to that bucket. --check needs neither: it downloads and
 * checks every image without touching AWS, and leaves `logo` empty.
 */
import { config as dotEnvConfig } from "dotenv";
import { setupAssetsCdnUpload, uploadIfMissing } from "./lib/assetsCdn";
import {
	currentLogoObjectKey,
	parseCurrentLogos,
	type CurrentTeamLogo,
	type EspnTeamLogo,
} from "./lib/currentLogos";
import { isPngSignature } from "./lib/pngAlpha";
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

const SOURCE_URL =
	"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";

const OUTPUT_PATH = dataPath("currentTeamLogos.json");

const USER_AGENT =
	"team-builder-refresh-current-logos/1.0 (https://github.com/; contact via repo)";

const EXPECTED_TEAMS = 30;

// The URL shape teams saved before #217 store as their logoUrl.
const ESPN_LOGO_PATTERN =
	/^https:\/\/a\.espncdn\.com\/i\/teamlogos\/nba\/500\/[a-z]+\.png$/;

const IMAGE_SPACING_MS = 150;

// ESPN's 500px logos are tens of KB; anything this small is an error page.
const MIN_PNG_BYTES = 1000;

const IMAGE_TIMEOUT_MS = 15_000;

const fetchLogoImage = async (
	url: string,
	label: string,
	problems: string[],
): Promise<Uint8Array | null> => {
	let response: Response;
	try {
		response = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
		});
	} catch (err) {
		// A reset or a stalled download is reported with the rest, not as a crash.
		problems.push(`${label}: image request failed (${(err as Error).message})`);
		return null;
	}
	if (!response.ok) {
		problems.push(`${label}: image request returned ${response.status}`);
		return null;
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length < MIN_PNG_BYTES || !isPngSignature(bytes)) {
		problems.push(`${label}: response did not look like a PNG`);
		return null;
	}
	return bytes;
};

const main = async () => {
	const checkOnly = isCheckOnly();

	// Before any request, so a missing .env or expired credentials fail at once.
	const upload = checkOnly ? null : await setupAssetsCdnUpload();

	const body = await fetchPage(SOURCE_URL, USER_AGENT);
	const teams = parseOrThrow(body, parseCurrentLogos, "teams");

	const problems: string[] = [];

	if (teams.length !== EXPECTED_TEAMS) {
		problems.push(`Expected ${EXPECTED_TEAMS} teams, got ${teams.length}`);
	}

	const names = new Set<string>();
	const slugs = new Set<string>();

	for (const team of teams) {
		const label = team.name || "<unnamed>";

		if (!team.name) {
			problems.push("a row has no name");
		}

		if (!ESPN_LOGO_PATTERN.test(team.source)) {
			problems.push(
				`${label}: unexpected logo URL (${JSON.stringify(team.source)})`,
			);
		}

		if (names.has(team.name)) {
			problems.push(`${label}: duplicate name`);
		}
		names.add(team.name);

		if (slugs.has(team.slug)) {
			problems.push(`${label}: duplicate slug (${team.slug})`);
		}
		slugs.add(team.slug);
	}

	const images: { team: EspnTeamLogo; png: Uint8Array; key: string }[] = [];
	for (const team of teams.filter((t) => ESPN_LOGO_PATTERN.test(t.source))) {
		if (images.length > 0) await sleep(IMAGE_SPACING_MS);
		const png = await fetchLogoImage(team.source, team.name || team.slug, problems);
		if (png) images.push({ team, png, key: currentLogoObjectKey(team.slug, png) });
	}

	// Only a clean run uploads, so a bad one leaves the bucket untouched.
	const logos = new Map<string, string>();
	let uploaded = 0;
	let unchanged = 0;
	if (upload && problems.length === 0) {
		for (const { team, png, key } of images) {
			if (await uploadIfMissing(upload, key, png, "image/png")) uploaded++;
			else unchanged++;
			logos.set(team.slug, `https://${upload.distributionDomain}/${key}`);
		}
	}

	const rows: CurrentTeamLogo[] = teams.map((team) => ({
		name: team.name,
		slug: team.slug,
		logo: logos.get(team.slug) ?? "",
	}));

	console.log(
		`${rows.length} teams, ${images.length} logos downloaded` +
			(upload ? `, ${uploaded} uploaded, ${unchanged} already on the CDN` : ""),
	);

	writeIfClean(OUTPUT_PATH, rows, problems, checkOnly);
};

run(main);
