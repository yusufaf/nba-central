/**
 * Regenerates nba-central's checked-in currentTeamLogos.json, the only writer
 * of that file. One request to ESPN's public teams endpoint, run by hand when
 * a team rebrands (roughly once a decade) - never from a browser or per user
 * request.
 *
 *   pnpm run refresh-current-logos
 *   pnpm run refresh-current-logos -- --check    # verify only, write nothing
 */
import { parseCurrentLogos } from "./lib/currentLogos";
import {
	dataPath,
	fetchPage,
	isCheckOnly,
	parseOrThrow,
	run,
	writeIfClean,
} from "./lib/refresh";

const SOURCE_URL =
	"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";

const OUTPUT_PATH = dataPath("currentTeamLogos.json");

const USER_AGENT =
	"team-builder-refresh-current-logos/1.0 (https://github.com/; contact via repo)";

const EXPECTED_TEAMS = 30;

// The same URL shape saved teams already store as their logoUrl.
const LOGO_PATTERN =
	/^https:\/\/a\.espncdn\.com\/i\/teamlogos\/nba\/500\/[a-z]+\.png$/;

const main = async () => {
	const checkOnly = isCheckOnly();

	const body = await fetchPage(SOURCE_URL, USER_AGENT);
	const teams = parseOrThrow(body, parseCurrentLogos, "teams");

	const problems: string[] = [];

	if (teams.length !== EXPECTED_TEAMS) {
		problems.push(`Expected ${EXPECTED_TEAMS} teams, got ${teams.length}`);
	}

	const names = new Set<string>();
	const logos = new Set<string>();

	for (const team of teams) {
		const label = team.name || "<unnamed>";

		if (!team.name) {
			problems.push("a row has no name");
		}

		if (!LOGO_PATTERN.test(team.logo)) {
			problems.push(
				`${label}: unexpected logo URL (${JSON.stringify(team.logo)})`,
			);
		}

		if (names.has(team.name)) {
			problems.push(`${label}: duplicate name`);
		}
		names.add(team.name);

		if (logos.has(team.logo)) {
			problems.push(`${label}: duplicate logo (${team.logo})`);
		}
		logos.add(team.logo);
	}

	console.log(`${teams.length} teams`);

	writeIfClean(OUTPUT_PATH, teams, problems, checkOnly);
};

run(main);
