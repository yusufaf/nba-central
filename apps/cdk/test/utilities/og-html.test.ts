import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildOgTags, escapeHtml, injectOgTags } from "../../utilities/og-html";
import type { PublicTeam } from "../../models/api/teams-api";

const team: PublicTeam = {
	teamUUID: "t1",
	username: "yusuf",
	title: `Bulls <"96">`,
	description: "",
	city: "Chicago",
	country: "USA",
	logoUrl: "",
	jerseyUrl: "",
	playerCount: 6,
	roster: [
		{ slot: 1, player: { fullName: "Michael Jordan" } },
		{ slot: 6, player: { fullName: "Bench Guy" } },
		{ slot: 2, player: { fullName: "Scottie Pippen" } },
	],
	coach: { name: "Phil Jackson", isCustom: false },
	gm: null,
	arena: null,
	createdAt: 1,
	updatedAt: 2,
	public: true,
	cardUrl: "https://cdn.example/cards/t1/2.png",
};

describe("escapeHtml", () => {
	it("escapes the five HTML-significant characters", () => {
		expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
			"&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
		);
	});
});

describe("buildOgTags", () => {
	it("describes the starters in slot order, the coach, and the owner", () => {
		const tags = buildOgTags(team, "https://nba.example");
		expect(tags).toContain(
			'<meta property="og:description" content="Starting five: Michael Jordan, Scottie Pippen · Coach Phil Jackson · by yusuf">',
		);
	});

	it("escapes user input in the title and points at the card and page", () => {
		const tags = buildOgTags(team, "https://nba.example");
		expect(tags).toContain('<meta property="og:title" content="Bulls &lt;&quot;96&quot;&gt;">');
		expect(tags).toContain('<meta property="og:image" content="https://cdn.example/cards/t1/2.png">');
		expect(tags).toContain('<meta property="og:url" content="https://nba.example/t/t1">');
		expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">');
	});

	it("includes the image dimensions when a card is present", () => {
		const tags = buildOgTags(team, "https://nba.example");
		expect(tags).toContain('<meta property="og:image:width" content="1200">');
		expect(tags).toContain('<meta property="og:image:height" content="630">');
	});

	it("falls back to the hero poster when there is no card", () => {
		const tags = buildOgTags({ ...team, cardUrl: undefined }, "https://nba.example");
		expect(tags).toContain('<meta property="og:image" content="https://nba.example/hero/hero-poster.jpg">');
		expect(tags).not.toContain("og:image:width");
		expect(tags).not.toContain("og:image:height");
	});
});

describe("injectOgTags", () => {
	it("replaces the title and inserts the tags before </head>", () => {
		const shell = "<html><head><title>NBA Team Builder</title></head><body></body></html>";
		const out = injectOgTags(shell, team, "https://nba.example");
		expect(out).toContain("<title>Bulls &lt;&quot;96&quot;&gt; — nba-central</title>");
		expect(out.indexOf('property="og:title"')).toBeLessThan(out.indexOf("</head>"));
		expect(out).not.toContain("<title>NBA Team Builder</title>");
	});

	it("replaces the shell's default description, canonical, and share tags with the team's", () => {
		const shell = [
			"<html><head>",
			'<meta name="viewport" content="width=device-width">',
			"<title>nba-central</title>",
			'<meta name="description" content="Site description">',
			'<link rel="canonical" href="https://nba.example/">',
			'<meta property="og:title" content="Site title">',
			'<meta property="og:image" content="https://nba.example/og-image.jpg">',
			'<meta property="og:image:width" content="1200">',
			'<meta name="twitter:card" content="summary_large_image">',
			"</head><body></body></html>",
		].join("\n");
		const out = injectOgTags(shell, team, "https://nba.example");
		for (const tag of ['name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:image"', 'property="og:image:width"', 'name="twitter:card"']) {
			expect(out.split(tag)).toHaveLength(2);
		}
		expect(out).not.toContain("Site description");
		expect(out).not.toContain("Site title");
		expect(out).not.toContain("og-image.jpg");
		expect(out).toContain('<link rel="canonical" href="https://nba.example/t/t1">');
		expect(out).toContain('<meta name="viewport" content="width=device-width">');
	});

	it("leaves exactly one of every head tag in the web app's real index.html", () => {
		// The tag list comes from the file itself, so a tag added there later is
		// covered too: one the team page should override but SHELL_DEFAULT_TAGS
		// doesn't strip shows up twice, and one it strips without the team page
		// re-emitting it shows up zero times.
		const shell = readFileSync(resolve(__dirname, "../../../web/index.html"), "utf8");
		const head = shell.slice(0, shell.indexOf("</head>"));
		const keys = [...head.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(([tag]) => {
			const key = /\b(?:property|name|rel|charset)="[^"]*"/.exec(tag);
			expect(key, `no identifying attribute on ${tag}`).not.toBeNull();
			return key![0];
		});
		for (const key of ['name="description"', 'rel="canonical"', 'property="og:image:alt"', 'property="og:description"', 'name="twitter:title"']) {
			expect(keys).toContain(key);
		}

		const out = injectOgTags(shell, team, "https://nba.example");
		for (const key of keys) {
			expect(out.split(key).length - 1, key).toBe(1);
		}

		expect(out).toContain('<link rel="canonical" href="https://nba.example/t/t1">');
		expect(out).toContain('<meta property="og:url" content="https://nba.example/t/t1">');
		expect(out).toContain('<meta name="twitter:title" content="Bulls &lt;&quot;96&quot;&gt;">');
		expect(out).toContain('<meta property="og:image:alt" content="Bulls &lt;&quot;96&quot;&gt; team card">');
		expect(out).toContain('<meta property="og:description" content="Starting five: Michael Jordan, Scottie Pippen · Coach Phil Jackson · by yusuf">');
		expect(out).not.toContain("https://nba.yusufaf.dev/");
	});

	it("inserts titles containing $-patterns literally instead of expanding them", () => {
		const shell = '<html><head><meta charset="UTF-8"><title>NBA Team Builder</title></head><body></body></html>';
		const out = injectOgTags(shell, { ...team, title: "Bulls $` $& $' $$ 96" }, "https://nba.example");
		expect(out).toContain("<title>Bulls $` $&amp; $&#39; $$ 96 — nba-central</title>");
		expect(out).toContain('<meta property="og:title" content="Bulls $` $&amp; $&#39; $$ 96">');
		// The shell's own markup must not have been spliced into the title.
		expect(out.match(/<meta charset="UTF-8">/g)).toHaveLength(1);
	});
});
