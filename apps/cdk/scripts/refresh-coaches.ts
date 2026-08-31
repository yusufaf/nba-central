/**
 * Regenerates nba-central's checked-in coaches.json using the same parser the
 * setCoachesData Lambda runs.
 *
 *   pnpm run refresh-coaches
 *   pnpm run refresh-coaches -- --check    # verify only, write nothing
 */
import { parseCoaches } from "../service/lambdas/setCoachesData/src/setCoachesData";
import {
	dataPath,
	fetchPage,
	isCheckOnly,
	parseOrThrow,
	run,
	writeIfClean,
} from "./lib/refresh";

const SOURCE_URL =
	"https://www.basketball-reference.com/coaches/NBA_stats.html";

const OUTPUT_PATH = dataPath("coaches.json");

const USER_AGENT =
	"team-builder-refresh-coaches/1.0 (https://github.com/; contact via repo)";

const INTEGER_FIELDS = ["rank", "from", "to", "yrs", "g", "w", "l"];

// Basketball-Reference renders win percentages without a leading zero
// (".582"). The parser falls back to "0" for a coach with no playoff games,
// and a perfect record is the one case that carries a leading digit.
const PERCENT_PATTERN = /^(0|1\.000|\.\d{3})$/;

const PERCENT_FIELDS = ["wlPercent", "playoffWLPercent"];

const main = async () => {
	const checkOnly = isCheckOnly();

	const body = await fetchPage(SOURCE_URL, USER_AGENT);
	const coaches = parseOrThrow(body, parseCoaches, "coaches");

	const problems: string[] = [];

	for (const coach of coaches) {
		const label = coach.name || "<unnamed>";

		if (!coach.name) {
			problems.push(`row ${coach.rank}: missing name`);
		}

		for (const field of INTEGER_FIELDS) {
			if (!Number.isInteger(coach[field])) {
				problems.push(
					`${label}: ${field} is not an integer (${JSON.stringify(coach[field])})`,
				);
			}
		}

		for (const field of PERCENT_FIELDS) {
			// The string check is the important half: coachWinPercent() in
			// CoachSection.vue renders "0%" for anything numeric, so a parsed
			// percentage would blank out the whole column.
			if (typeof coach[field] !== "string") {
				problems.push(
					`${label}: ${field} is ${typeof coach[field]}, expected string`,
				);
			} else if (!PERCENT_PATTERN.test(coach[field])) {
				problems.push(
					`${label}: ${field} has an unexpected format (${JSON.stringify(coach[field])})`,
				);
			}
		}
	}

	// isHallOfFamer() keys off the trailing "*", so losing the suffix would
	// silently empty the Hall of Famer filter.
	const hallOfFamers = coaches.filter((coach) =>
		String(coach.name).endsWith("*"),
	).length;
	if (hallOfFamers === 0) {
		problems.push('No names carry the Hall of Fame "*" suffix');
	} else {
		console.log(`${hallOfFamers} Hall of Famers`);
	}

	writeIfClean(OUTPUT_PATH, coaches, problems, checkOnly);
};

run(main);
