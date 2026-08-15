/**
 * Shared spine for the refresh-* scripts.
 *
 * Each of nba-central's checked-in datasets (arenas, coaches, execs) is small
 * and rarely-changing, so the frontend imports the JSON directly rather than
 * fetching it. Regenerating one is therefore a deliberate, reviewable step:
 * fetch the source page, run the same parser the Lambda runs, validate every
 * row, and refuse to write anything if a single row looks wrong.
 *
 *   pnpm run refresh-<dataset>
 *   pnpm run refresh-<dataset> -- --check    # verify only, write nothing
 */
import * as fs from "fs";
import * as path from "path";

export type Row = { [key: string]: any };

/** True when the caller passed --check, i.e. validate but write nothing. */
export const isCheckOnly = () => process.argv.includes("--check");

export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves a path relative to nba-central's static data directory. */
export const dataPath = (fileName: string) =>
	path.resolve(__dirname, "../../../nba-central/src/assets/data", fileName);

export const fetchPage = async (url: string, userAgent: string) => {
	const response = await fetch(url, { headers: { "User-Agent": userAgent } });
	if (!response.ok) {
		throw new Error(`${url} responded ${response.status}`);
	}
	return response.text();
};

/**
 * Runs `parse` over the fetched page and fails loudly on an empty result -
 * zero rows means the upstream table layout changed, not that the league lost
 * all its coaches.
 */
export const parseOrThrow = <T extends Row>(
	body: string,
	parse: (body: string) => T[],
	label: string,
) => {
	const rows = parse(body);
	if (rows.length === 0) {
		throw new Error(
			`No ${label} parsed - the source table layout likely changed`,
		);
	}
	console.log(`Parsed ${rows.length} ${label}`);
	return rows;
};

/**
 * Writes `rows` to `outputPath` unless `problems` is non-empty, in which case
 * it reports every problem and throws. Under --check it validates and returns
 * without touching the file.
 */
export const writeIfClean = (
	outputPath: string,
	rows: Row[],
	problems: string[],
	checkOnly: boolean,
) => {
	if (problems.length > 0) {
		console.error(`\n${problems.length} problem(s):`);
		for (const problem of problems) {
			console.error(`  ${problem}`);
		}
		throw new Error(`Refusing to write ${path.basename(outputPath)}`);
	}

	console.log(`All ${rows.length} rows validated`);

	if (checkOnly) {
		console.log("--check passed, nothing written");
		return;
	}

	fs.writeFileSync(outputPath, `${JSON.stringify(rows, null, 4)}\n`, "utf8");
	console.log(`Wrote ${outputPath}`);
};

/** Shared entry point so every script reports failures the same way. */
export const run = (main: () => Promise<void>) => {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
};
