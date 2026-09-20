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
	const image = escapeHtml(team.cardUrl || `${siteUrl}/hero/poster.jpg`);
	const url = escapeHtml(`${siteUrl}/t/${team.teamUUID}`);
	return [
		`<meta property="og:type" content="website">`,
		`<meta property="og:title" content="${title}">`,
		`<meta property="og:description" content="${description}">`,
		`<meta property="og:image" content="${image}">`,
		`<meta property="og:image:width" content="1200">`,
		`<meta property="og:image:height" content="630">`,
		`<meta property="og:url" content="${url}">`,
		`<meta name="twitter:card" content="summary_large_image">`,
		`<meta name="twitter:title" content="${title}">`,
		`<meta name="twitter:description" content="${description}">`,
		`<meta name="twitter:image" content="${image}">`,
	].join("\n");
};

// The SPA shell is index.html as deployed — hashed asset URLs and all. Only
// the <title> and the <head> tail change; the body boots Vue as usual.
export const injectOgTags = (shell: string, team: PublicTeam, siteUrl: string): string => {
	const title = `<title>${escapeHtml(team.title || "Untitled team")} — NBA Team Builder</title>`;
	return shell
		.replace(/<title>[\s\S]*?<\/title>/, () => title)
		.replace("</head>", () => `${buildOgTags(team, siteUrl)}\n</head>`);
};
