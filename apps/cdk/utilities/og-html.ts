import { PublicTeam } from "models/api/teams-api";

// Everything here ends up inside an attribute value on a page anyone can
// load — team titles, cities, and player names are all user-controlled.
export const escapeHtml = (value: string): string =>
	value.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case "&": return "&amp;";
			case "<": return "&lt;";
			case ">": return "&gt;";
			case '"': return "&quot;";
			default: return "&#39;";
		}
	});

const STARTER_SLOTS = new Set([1, 2, 3, 4, 5]);

export const describeTeam = (team: PublicTeam): string => {
	const starters = (team.roster ?? [])
		.filter((entry) => STARTER_SLOTS.has(entry.slot))
		.sort((a, b) => a.slot - b.slot)
		.map((entry) => entry.player.fullName);
	const parts: string[] = [];
	if (starters.length) parts.push(`Starting five: ${starters.join(", ")}`);
	if (team.coach?.name) parts.push(`Coach ${team.coach.name}`);
	parts.push(`by ${team.username}`);
	return parts.join(" · ");
};

export const buildOgTags = (team: PublicTeam, siteUrl: string): string => {
	const title = escapeHtml(team.title || "Untitled team");
	const description = escapeHtml(describeTeam(team));
	// The hero poster isn't 1200x630, so only the rendered card gets explicit
	// dimensions — unfurlers fall back to probing the image otherwise.
	const image = escapeHtml(team.cardUrl || `${siteUrl}/hero/hero-poster.jpg`);
	const url = escapeHtml(`${siteUrl}/t/${team.teamUUID}`);
	return [
		`<meta name="description" content="${description}">`,
		`<link rel="canonical" href="${url}">`,
		`<meta property="og:type" content="website">`,
		`<meta property="og:title" content="${title}">`,
		`<meta property="og:description" content="${description}">`,
		`<meta property="og:image" content="${image}">`,
		...(team.cardUrl
			? [
				`<meta property="og:image:width" content="1200">`,
				`<meta property="og:image:height" content="630">`,
				`<meta property="og:image:alt" content="${title} team card">`,
			]
			: []),
		`<meta property="og:url" content="${url}">`,
		`<meta name="twitter:card" content="summary_large_image">`,
		`<meta name="twitter:title" content="${title}">`,
		`<meta name="twitter:description" content="${description}">`,
		`<meta name="twitter:image" content="${image}">`,
	].join("\n");
};

// The site-wide description, canonical, and OG/Twitter tags index.html ships
// for every route. A team's own tags replace them: left in, the page would
// carry two of each and the canonical would claim the team page is the home
// page. og:site_name is the same on every page, so it stays. A tag added to
// index.html's head needs handling here too — og-html.test.ts checks every
// one of them against the real file. apps/web's build/gamePageHtml.ts strips
// the same set for /daily and /cap-five; keep the two in step.
const SHELL_DEFAULT_TAGS =
	/<(?:meta\s+(?:property="og:(?!site_name")[^"]*"|name="(?:twitter:[^"]*|description)")|link\s+rel="canonical")[^>]*>\s*/g;

export const stripShellDefaults = (shell: string): string => shell.replace(SHELL_DEFAULT_TAGS, "");

// An unknown or private team still gets the shell (the SPA shows its own
// not-found view), but the route can't answer 404 through CloudFront, so
// this keeps crawlers from indexing every made-up /t/ URL. No canonical or
// share tags: the home page's would misdescribe it.
export const notFoundPage = (shell: string): string =>
	stripShellDefaults(shell).replace("</head>", () => `<meta name="robots" content="noindex">\n</head>`);

// The SPA shell is index.html as deployed — hashed asset URLs and all. Only
// the <title> and the <head> tags change; the body boots Vue as usual.
export const injectOgTags = (shell: string, team: PublicTeam, siteUrl: string): string => {
	const title = `<title>${escapeHtml(team.title || "Untitled team")} — nba-central</title>`;
	return stripShellDefaults(shell)
		.replace(/<title>[\s\S]*?<\/title>/, () => title)
		.replace("</head>", () => `${buildOgTags(team, siteUrl)}\n</head>`);
};
