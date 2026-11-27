/**
 * Parser for the current team logos dataset: turns ESPN's NBA teams list into
 * the team, slug and ESPN logo URL that refresh-current-logos.ts downloads.
 * The rows checked in as apps/web's currentTeamLogos.json hold the assets CDN
 * copy of each logo, not ESPN's URL.
 */
import { createHash } from "crypto";

/** One team as ESPN lists it; `source` is ESPN's default logo URL. */
export type EspnTeamLogo = { name: string; slug: string; source: string };

/** One row of currentTeamLogos.json; `logo` is the assets CDN URL. */
export type CurrentTeamLogo = { name: string; slug: string; logo: string };

type EspnLogo = { href?: string; rel?: string[] };
type EspnTeam = { displayName?: string; logos?: EspnLogo[] };

// The dialog has always listed teams in the order of their logo file names
// (atl, bos, ..., utah, wsh), so the checked-in rows keep it.
const fileName = (href: string) => href.split("/").pop() ?? "";

export const parseCurrentLogos = (body: string): EspnTeamLogo[] => {
	const data = JSON.parse(body);
	const entries: { team?: EspnTeam }[] =
		data?.sports?.[0]?.leagues?.[0]?.teams ?? [];

	return entries
		.map(({ team }) => {
			// ESPN lists a dozen-plus variants per team (dark, scoreboard, ...).
			// "default" is the one the logo dialog has always used.
			const source = team?.logos?.find((l) => l.rel?.includes("default"))?.href ?? "";
			return {
				name: team?.displayName ?? "",
				slug: /\/([a-z]+)\.png$/.exec(source)?.[1] ?? "",
				source,
			};
		})
		.sort((a, b) => fileName(a.source).localeCompare(fileName(b.source)));
};

export const CURRENT_LOGO_KEY_PREFIX = "logos/current/";

/**
 * The assets bucket key for one team's logo. Content-addressed, like
 * logoObjectKey for the historical logos, so a rebrand lands on a new URL
 * that CACHING_OPTIMIZED has never cached, with no invalidation. No keying
 * version: the bytes are uploaded exactly as ESPN serves them.
 */
export const currentLogoObjectKey = (slug: string, png: Uint8Array): string =>
	`${CURRENT_LOGO_KEY_PREFIX}${slug}.${createHash("sha256").update(png).digest("hex").slice(0, 12)}.png`;
