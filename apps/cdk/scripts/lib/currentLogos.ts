/**
 * Parser for the current team logos dataset: turns ESPN's NBA teams list into the rows
 * checked in as apps/web's currentTeamLogos.json. Used by refresh-current-logos.ts.
 */
export type CurrentTeamLogo = { name: string; logo: string };

type EspnLogo = { href?: string; rel?: string[] };
type EspnTeam = { displayName?: string; logos?: EspnLogo[] };

// The dialog has always listed teams in the order of their logo file names
// (atl, bos, ..., utah, wsh), so the checked-in rows keep it.
const fileName = (href: string) => href.split("/").pop() ?? "";

export const parseCurrentLogos = (body: string): CurrentTeamLogo[] => {
	const data = JSON.parse(body);
	const entries: { team?: EspnTeam }[] =
		data?.sports?.[0]?.leagues?.[0]?.teams ?? [];

	return entries
		.map(({ team }) => ({
			name: team?.displayName ?? "",
			// ESPN lists a dozen-plus variants per team (dark, scoreboard, ...).
			// "default" is the one the logo dialog has always used.
			logo: team?.logos?.find((l) => l.rel?.includes("default"))?.href ?? "",
		}))
		.sort((a, b) => fileName(a.logo).localeCompare(fileName(b.logo)));
};
