/**
 * Regenerates nba-central's checked-in arenas.json using the same parser the
 * setArenasData Lambda runs, then verifies every image URL still resolves.
 *
 *   pnpm run refresh-arenas
 *   pnpm run refresh-arenas -- --check    # verify only, write nothing
 */
import { parseArenas } from "../service/lambdas/setArenasData/src/setArenasData";
import {
	dataPath,
	fetchPage,
	isCheckOnly,
	parseOrThrow,
	run,
	sleep,
	writeIfClean,
} from "./lib/refresh";

const SOURCE_URL = "https://en.wikipedia.org/wiki/List_of_NBA_arenas";

const OUTPUT_PATH = dataPath("arenas.json");

// Wikimedia rate-limits anonymous bulk requests, so identify ourselves and
// leave a gap between checks.
const USER_AGENT =
	"team-builder-refresh-arenas/1.0 (https://github.com/; contact via repo)";
const REQUEST_SPACING_MS = 400;
const RETRY_LIMIT = 5;

const REQUIRED_FIELDS = ["imgLink", "name", "location", "team", "capacity"];

const checkImage = async (url: string) => {
	for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
		const response = await fetch(url, {
			method: "HEAD",
			headers: { "User-Agent": USER_AGENT },
		});
		if (response.status !== 429) {
			return response.status;
		}
		await sleep(REQUEST_SPACING_MS * 5 * (attempt + 1));
	}
	return 429;
};

const main = async () => {
	const checkOnly = isCheckOnly();

	const body = await fetchPage(SOURCE_URL, USER_AGENT);
	const arenas = parseOrThrow(body, parseArenas, "arenas");

	const problems: string[] = [];

	const names = arenas.map((arena) => arena.name);
	for (const name of new Set(names)) {
		const count = names.filter((candidate) => candidate === name).length;
		if (count > 1) {
			// Two teams can legitimately share a building, so this is worth a
			// look rather than an automatic failure.
			console.warn(
				`Note: "${name}" appears ${count} times (shared arena?)`,
			);
		}
	}

	for (const arena of arenas) {
		for (const field of REQUIRED_FIELDS) {
			if (!arena[field]) {
				problems.push(`${arena.name || "<unnamed>"}: missing ${field}`);
			}
		}
		if (!Number.isInteger(arena.openedYear)) {
			problems.push(`${arena.name}: openedYear is not a number`);
		}

		if (arena.imgLink) {
			const status = await checkImage(arena.imgLink);
			if (status !== 200) {
				problems.push(`${arena.name}: image returned ${status}`);
			}
			await sleep(REQUEST_SPACING_MS);
		}
	}

	writeIfClean(OUTPUT_PATH, arenas, problems, checkOnly);
};

run(main);
