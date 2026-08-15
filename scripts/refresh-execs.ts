/**
 * Regenerates nba-central's checked-in execs.json using the same parser the
 * setExecsData Lambda runs.
 *
 *   pnpm run refresh-execs
 *   pnpm run refresh-execs -- --check    # verify only, write nothing
 */
import { parseExecs } from "../service/lambdas/setExecsData/src/setExecsData";
import {
	dataPath,
	fetchPage,
	isCheckOnly,
	parseOrThrow,
	run,
	writeIfClean,
} from "./lib/refresh";

const SOURCE_URL = "https://www.basketball-reference.com/executives/";

const OUTPUT_PATH = dataPath("execs.json");

const USER_AGENT =
	"team-builder-refresh-execs/1.0 (https://github.com/; contact via repo)";

const NON_BREAKING_SPACE = /\u00A0/;

// Every stint reads "ABC (years)". A leftover non-breaking space or a stint
// that got glued to the next one both show up as a miss here.
const STINT_PATTERN = /^[A-Z]{3}(\/[A-Z]{3})* \(.+\)$/;

const main = async () => {
	const checkOnly = isCheckOnly();

	const body = await fetchPage(SOURCE_URL, USER_AGENT);
	const execs = parseOrThrow(body, parseExecs, "executives");

	const problems: string[] = [];

	for (const exec of execs) {
		const label = exec.name || "<unnamed>";

		if (!exec.name) {
			problems.push("a row has no name");
		}

		// The old parser stripped periods along with non-breaking spaces, which
		// turned "R.C. Buford" into "RC Buford".
		if (NON_BREAKING_SPACE.test(exec.name)) {
			problems.push(`${label}: name still contains a non-breaking space`);
		}

		if (!Array.isArray(exec.teams) || exec.teams.length === 0) {
			problems.push(
				`${label}: teams is not a non-empty array (${JSON.stringify(exec.teams)})`,
			);
			continue;
		}

		for (const stint of exec.teams) {
			if (typeof stint !== "string") {
				problems.push(`${label}: a stint is not a string`);
			} else if (!STINT_PATTERN.test(stint)) {
				problems.push(
					`${label}: unexpected stint format (${JSON.stringify(stint)})`,
				);
			}
		}
	}

	const active = execs.filter((exec) => exec.active).length;
	if (active === 0) {
		problems.push("No executives are marked active");
	} else {
		console.log(`${active} active executives`);
	}

	writeIfClean(OUTPUT_PATH, execs, problems, checkOnly);
};

run(main);
