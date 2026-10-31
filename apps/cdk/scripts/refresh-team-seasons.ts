/**
 * Publishes the team-season files: for every finished NBA, BAA and ABA
 * season, each team's name, arena, coach and 15 players in Team Builder slot
 * order, as `team-seasons/{L}-{Y}.json` in the assets bucket, plus the index
 * at `live/team-seasons/index.json`. The web reads them to start a team from
 * a real one. The current season is setPlayersData's job.
 *
 *   pnpm run refresh-team-seasons
 *   pnpm run refresh-team-seasons -- --check --only NBA-1996  # fetch + validate, upload nothing
 *   pnpm run refresh-team-seasons -- --only NBA-1996,ABA-1975  # just these (re-publishes them)
 *
 * A finished season never changes, so a normal run only scrapes seasons the
 * published index doesn't have yet: the first run takes ~16 minutes (3 pages a
 * season, 3.5 s apart), later ones a few seconds once a year. The index is
 * rewritten after every season, so an interrupted run picks up where it
 * stopped. Basketball-Reference's Data Use page asks that its data not feed
 * other sites, so only the ordered roster is published, never the numbers
 * that ordered it, and nothing is written into the repo.
 *
 * A real run needs apps/cdk's .env and AWS credentials for the assets and
 * static-data buckets; --check needs neither.
 */
import { config as dotEnvConfig } from "dotenv";
import * as fs from "fs";
import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { setupAssetsCdnUpload } from "./lib/assetsCdn";
import { dataPath, fetchPage, isCheckOnly, parseOrThrow, run, sleep } from "./lib/refresh";
import {
	buildTeamSeasonFile,
	finishedSeasons,
	franchiseResolver,
	indexSeason,
	parseCoaches,
	parseLeagueTeams,
	parsePerGame,
	seasonPaths,
	withIndexSeason,
} from "./lib/teamSeasons";
import {
	LIVE_JSON_CACHE_CONTROL,
	TEAM_SEASON_CACHE_CONTROL,
	TEAM_SEASONS_INDEX_KEY,
	teamSeasonKey,
} from "../utilities/live-data";
import { currentSeasonEndYear } from "../utilities/season";
import type { TeamSeasonsIndex } from "../models/team-seasons";

dotEnvConfig();

const BBREF_BASE_URL = "https://www.basketball-reference.com";
const USER_AGENT =
	"team-builder-refresh-team-seasons/1.0 (https://github.com/; contact via repo)";
// Under BBRef's 20 requests a minute, like the other refresh scripts.
const PAGE_SPACING_MS = 3500;

const onlyArg = (): Set<string> | null => {
	const index = process.argv.indexOf("--only");
	if (index === -1) return null;
	const value = process.argv[index + 1];
	if (!value) throw new Error("--only needs a list, e.g. --only NBA-1996,ABA-1975");
	return new Set(value.split(",").map((s) => s.trim().toUpperCase()));
};

const readJson = async <T>(s3: S3Client, bucket: string, key: string): Promise<T | null> => {
	try {
		const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
		return JSON.parse(await response.Body!.transformToString()) as T;
	} catch (err) {
		// Only a missing object means "nothing yet"; anything else would make
		// this run re-scrape every season or forget published ones.
		if ((err as Error).name === "NoSuchKey") return null;
		throw err;
	}
};

const putJson = (s3: S3Client, bucket: string, key: string, body: unknown, cacheControl: string) =>
	s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: `${JSON.stringify(body)}\n`,
			ContentType: "application/json",
			CacheControl: cacheControl,
		}),
	);

// players.json's coarse G/F/C positions fill the season pages' blank ones
// (most of the BAA). --check has no AWS access, so it leaves them blank and
// those teams' starters keep their minutes/points order.
const loadCoarsePositions = async (s3: S3Client, bucket: string) => {
	const players = await readJson<{ data: { id: string; position: string }[] }>(s3, bucket, "players.json");
	if (!players?.data?.length) throw new Error(`No players in ${bucket}/players.json`);
	return new Map(players.data.filter((p) => p.position).map((p) => [String(p.id), p.position]));
};

let firstRequest = true;
const fetchSeasonPage = async (path: string) => {
	if (!firstRequest) await sleep(PAGE_SPACING_MS);
	firstRequest = false;
	// fetchPage throws on a 429 too: BBRef's limit puts the client in jail for
	// up to a day, and retrying only extends it.
	return fetchPage(`${BBREF_BASE_URL}${path}`, USER_AGENT);
};

const main = async () => {
	const checkOnly = isCheckOnly();
	const only = onlyArg();
	// Without the published index to skip against, a full check would scrape
	// every season, the same load as the real run it is meant to precede.
	if (checkOnly && !only) {
		throw new Error("--check needs --only, e.g. --check --only NBA-1996,BAA-1947,ABA-1975");
	}
	const { appName, deploymentType } = process.env;

	const upload = checkOnly ? null : await setupAssetsCdnUpload();
	const staticBucket = `${appName}-${deploymentType}-static-data`;
	const coarsePositions = upload
		? await loadCoarsePositions(upload.s3Client, staticBucket)
		: new Map<string, string>();
	let index: TeamSeasonsIndex = (upload &&
		(await readJson<TeamSeasonsIndex>(upload.s3Client, upload.bucketName, TEAM_SEASONS_INDEX_KEY))) || {
		version: 1,
		generatedAt: new Date().toISOString(),
		seasons: [],
	};

	const franchiseOf = franchiseResolver(
		JSON.parse(fs.readFileSync(dataPath("historicalLogos.json"), "utf8")),
	);
	const published = new Set(index.seasons.map((s) => `${s.league}-${s.year}`));
	const todo = finishedSeasons(currentSeasonEndYear() - 1).filter(({ league, year }) => {
		const id = `${league}-${year}`;
		return only ? only.has(id) : !published.has(id);
	});
	const unknown = [...(only ?? [])].filter((id) => !todo.some((s) => `${s.league}-${s.year}` === id));
	if (unknown.length) {
		throw new Error(`Not finished BAA/NBA/ABA seasons: ${unknown.join(", ")}`);
	}
	console.log(`${todo.length} season(s) to scrape, ${published.size} already published`);

	for (const { league, year } of todo) {
		const paths = seasonPaths(league, year);
		const id = `${league}-${year}`;
		const perGame = parseOrThrow(await fetchSeasonPage(paths.perGame), parsePerGame, `${id} player rows`);
		const coaches = parseOrThrow(
			await fetchSeasonPage(paths.coaches),
			(body) => parseCoaches(body, league),
			`${id} coaches`,
		);
		const teams = parseOrThrow(await fetchSeasonPage(paths.league), parseLeagueTeams, `${id} teams`);

		const generatedAt = new Date().toISOString();
		const { file, problems } = buildTeamSeasonFile(
			{ league, year, perGame, coaches, teams },
			franchiseOf,
			coarsePositions,
			generatedAt,
		);
		if (problems.length) {
			for (const problem of problems) console.error(`  ${problem}`);
			throw new Error(`Refusing to publish ${id}`);
		}
		const key = teamSeasonKey(league, year);
		// Also catches a CODE-YEAR used by two leagues before anything uploads.
		const seasons = withIndexSeason(index.seasons, indexSeason(file, key));
		const starters = file.teams.filter((t) => t.starters === 5).length;
		console.log(`${id}: ${file.teams.length} teams, ${starters} with five starters`);
		index = { version: 1, generatedAt, seasons };

		if (!upload) continue;
		await putJson(upload.s3Client, upload.bucketName, key, file, TEAM_SEASON_CACHE_CONTROL);
		await putJson(upload.s3Client, upload.bucketName, TEAM_SEASONS_INDEX_KEY, index, LIVE_JSON_CACHE_CONTROL);
	}

	console.log(checkOnly ? "--check passed, nothing uploaded" : `Index has ${index.seasons.length} seasons`);
};

run(main);
