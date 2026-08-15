import { describe, it, expect } from "vitest";
import { parseCoaches } from "lambdas/setCoachesData/src/setCoachesData";

// A trimmed copy of basketball-reference.com/coaches/NBA_stats.html: the
// repeated header row, one plain coach and one Hall of Famer. `season_min` and
// `season_max` are the current upstream names for what used to be `year_min`
// and `year_max`.
const buildPage = (rows: string) => `
<html><body>
<table id="coaches">
	<thead>
		<tr class="over_header thead"><th colspan="17">Overall</th></tr>
		<tr class="thead">
			<th data-stat="ranker">Rk</th>
			<th data-stat="coach">Coach</th>
			<th data-stat="season_min">From</th>
			<th data-stat="season_max">To</th>
		</tr>
	</thead>
	<tbody>${rows}</tbody>
</table>
</body></html>
`;

const coachRow = (
	name: string,
	{
		href = "/coaches/testco01c.html",
		extraCells = "",
		playoffWLPercentCell = '<td data-stat="win_loss_pct_playoffs">.503</td>',
	} = {},
) => `
	<tr>
		<th data-stat="ranker">1</th>
		<td data-stat="coach"><a href="${href}">${name}</a></td>
		<td data-stat="season_min">1989</td>
		<td data-stat="season_max">2014</td>
		<td data-stat="years">23</td>
		<td data-stat="g">1791</td>
		<td data-stat="wins">1042</td>
		<td data-stat="losses">749</td>
		<td data-stat="win_loss_pct">.582</td>
		<td data-stat="wins_over_500">146.5</td>
		<td data-stat="g_playoffs">157</td>
		<td data-stat="wins_playoffs">79</td>
		<td data-stat="losses_playoffs">78</td>
		${playoffWLPercentCell}
		<td data-stat="years_conference_champion">2</td>
		<td data-stat="years_league_champion">0</td>
		${extraCells}
	</tr>
`;

// The column headers repeat every 20 rows or so inside the tbody.
const REPEATED_HEADER_ROW = `
	<tr class="thead">
		<th data-stat="ranker">Rk</th>
		<th data-stat="coach">Coach</th>
	</tr>
`;

describe("parseCoaches", () => {
	it("emits exactly the keys the frontend Coach type expects", () => {
		const [coach] = parseCoaches(buildPage(coachRow("Rick Adelman*")));

		expect(coach).toEqual({
			rank: 1,
			href: "/coaches/testco01c.html",
			name: "Rick Adelman*",
			from: 1989,
			to: 2014,
			yrs: 23,
			g: 1791,
			w: 1042,
			l: 749,
			wlPercent: ".582",
			wGreaterThan500: 146.5,
			playoffG: 157,
			playoffW: 79,
			playoffL: 78,
			playoffWLPercent: ".503",
			confTitles: 2,
			championships: 0,
		});
	});

	it("populates from/to off the renamed season_min and season_max columns", () => {
		const [coach] = parseCoaches(buildPage(coachRow("Rick Adelman*")));

		expect(coach.from).toBe(1989);
		expect(coach.to).toBe(2014);
	});

	it("keeps win percentages as strings", () => {
		// coachWinPercent() in CoachSection.vue renders "0%" for any numeric
		// input, so parsing these would blank out the column.
		const [coach] = parseCoaches(buildPage(coachRow("Rick Adelman*")));

		expect(typeof coach.wlPercent).toBe("string");
		expect(typeof coach.playoffWLPercent).toBe("string");
	});

	it('falls back an empty playoff win% cell to "0" instead of NaN', () => {
		// A coach with no playoff appearances has an empty
		// win_loss_pct_playoffs cell. coachWinPercent() in CoachSection.vue does
		// parseFloat(wlPercent) * 100, and parseFloat("") is NaN.
		const [coach] = parseCoaches(
			buildPage(
				coachRow("Curly Armstrong", {
					playoffWLPercentCell:
						'<td data-stat="win_loss_pct_playoffs"></td>',
				}),
			),
		);

		expect(coach.playoffWLPercent).toBe("0");
	});

	it("preserves the Hall of Fame asterisk", () => {
		// isHallOfFamer() keys off the trailing "*".
		const [coach] = parseCoaches(buildPage(coachRow("Rick Adelman*")));

		expect(coach.name).toBe("Rick Adelman*");
	});

	it("ignores an unmapped data-stat instead of writing an undefined key", () => {
		const [coach] = parseCoaches(
			buildPage(
				coachRow("Richie Adubato", {
					extraCells: '<td data-stat="brand_new_column">7</td>',
				}),
			),
		);

		expect(coach).not.toHaveProperty("undefined");
		expect(coach).not.toHaveProperty("brand_new_column");
	});

	it("skips the header rows repeated inside the tbody", () => {
		const coaches = parseCoaches(
			buildPage(
				`${coachRow("Rick Adelman*")}${REPEATED_HEADER_ROW}${coachRow("Richie Adubato")}`,
			),
		);

		expect(coaches).toHaveLength(2);
		expect(coaches.map((coach) => coach.name)).toEqual([
			"Rick Adelman*",
			"Richie Adubato",
		]);
	});

	it("returns an empty array when the table is missing", () => {
		// The Lambda and the refresh script both turn this into a thrown error;
		// the parser itself just reports nothing found.
		expect(parseCoaches("<html><body></body></html>")).toEqual([]);
	});
});
