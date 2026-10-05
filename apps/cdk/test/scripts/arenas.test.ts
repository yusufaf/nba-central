import { describe, it, expect } from "vitest";
import { parseArenas } from "../../scripts/lib/arenas";

// A trimmed copy of the "Current arenas" table on en.wikipedia.org's
// List_of_NBA_arenas: a header row, a full row, and a row a rowspan above has
// split short.
const page = `
<html><body>
<table class="wikitable">
	<tbody>
		<tr><th>Image</th><th>Name</th><th>Location</th><th>Team</th><th>Capacity</th><th>Opened</th></tr>
		<tr>
			<td><img src="//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Arena.jpg/120px-Arena.jpg"></td>
			<td>TD Garden</td>
			<td>Boston, Massachusetts</td>
			<td>Boston Celtics</td>
			<td>19,156</td>
			<td>1995</td>
			<td>1995-96</td>
			<td>[1]</td>
		</tr>
		<tr><td>Boston Bruins</td><td>17,850</td></tr>
	</tbody>
</table>
</body></html>
`;

describe("parseArenas", () => {
	it("reads a full row, keeping capacity as printed and openedYear numeric", () => {
		const [arena, ...rest] = parseArenas(page);
		expect(rest).toEqual([]);
		expect(arena).toMatchObject({
			name: "TD Garden",
			location: "Boston, Massachusetts",
			team: "Boston Celtics",
			capacity: "19,156",
			openedYear: 1995,
		});
		expect(arena.imgLink).toBe(
			"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Arena.jpg/500px-Arena.jpg",
		);
	});

	it("skips header rows and rows too short to line up", () => {
		expect(parseArenas(page)).toHaveLength(1);
	});

	it("returns nothing for a page without the table", () => {
		expect(parseArenas("<html><body></body></html>")).toEqual([]);
	});
});
