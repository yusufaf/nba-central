import { describe, it, expect } from "vitest";
import { parseExecs } from "lambdas/setExecsData/src/setExecsData";

// Basketball-Reference separates a team abbreviation from its year range with a
// non-breaking space, which the parser has to normalise without touching the
// periods in a name like "R.C. Buford".
const NBSP = "\u00A0";

// A trimmed copy of basketball-reference.com/executives/. The real page carries
// a letter divider and a repeated column header - both marked .thead - before
// each alphabetical block.
const buildPage = (rows: string) => `
<html><body>
<table id="executives-index">
	<tbody>
		<tr class="over_header thead"><th data-stat="header_tmp" colspan="2">A</th></tr>
		<tr class="thead">
			<th data-stat="exec">Executive</th>
			<th data-stat="teams">Team(s)</th>
		</tr>
		${rows}
	</tbody>
</table>
</body></html>
`;

const execRow = (
	name: string,
	teamsCell: string,
	{ active = false, href = "/executives/testex01x.html" } = {},
) => {
	const anchor = `<a href="${href}">${name}</a>`;
	return `
	<tr>
		<th data-stat="exec">${active ? `<strong>${anchor}</strong>` : anchor}</th>
		<td data-stat="teams">${teamsCell}</td>
	</tr>
	`;
};

const stint = (team: string, years: string) =>
	`<a href="/teams/${team}/executives.html">${team}</a>${NBSP}(${years})`;

describe("parseExecs", () => {
	it("keeps the periods in an initialled name", () => {
		// The old parser stripped periods along with non-breaking spaces and
		// turned this into "RC Buford".
		const [exec] = parseExecs(
			buildPage(execRow("R.C. Buford", stint("SAS", "2002-19"))),
		);

		expect(exec.name).toBe("R.C. Buford");
	});

	it("normalises the non-breaking space inside a stint", () => {
		const [exec] = parseExecs(
			buildPage(execRow("Otto Adams", stint("FTW", "1957"))),
		);

		expect(exec.teams).toEqual(["FTW (1957)"]);
	});

	it("splits a multi-stint cell into one entry per stint", () => {
		const [exec] = parseExecs(
			buildPage(
				execRow(
					"Danny Ainge",
					`${stint("BOS", "2003-21")}, ${stint("UTA", "2021-27")}`,
				),
			),
		);

		expect(exec.teams).toEqual(["BOS (2003-21)", "UTA (2021-27)"]);
	});

	it("does not split on a comma inside a year range", () => {
		const [exec] = parseExecs(
			buildPage(
				execRow(
					"Danny Ainge",
					`${stint("BOS", "2003-21")}, ${stint("UTA", "2021, -22")}`,
				),
			),
		);

		expect(exec.teams).toEqual(["BOS (2003-21)", "UTA (2021, -22)"]);
	});

	it("marks a bolded executive active and carries the href", () => {
		const execs = parseExecs(
			buildPage(
				`${execRow("Koby Altman", stint("CLE", "2017-27"), {
					active: true,
					href: "/executives/altmako01x.html",
				})}${execRow("Red Auerbach", stint("BOS", "1950-84"))}`,
			),
		);

		expect(execs[0]).toMatchObject({
			name: "Koby Altman",
			active: true,
			href: "/executives/altmako01x.html",
		});
		expect(execs[1]).toMatchObject({
			name: "Red Auerbach",
			active: false,
		});
	});

	it("skips the letter dividers and repeated column headers", () => {
		const execs = parseExecs(
			buildPage(execRow("Otto Adams", stint("FTW", "1957"))),
		);

		expect(execs).toHaveLength(1);
		expect(execs[0].name).toBe("Otto Adams");
	});

	it("returns an empty array when the table is missing", () => {
		// The Lambda and the refresh script both turn this into a thrown error;
		// the parser itself just reports nothing found.
		expect(parseExecs("<html><body></body></html>")).toEqual([]);
	});
});
