import { describe, it, expect } from "vitest";
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

	it("falls back to the hero poster when there is no card", () => {
		const tags = buildOgTags({ ...team, cardUrl: undefined }, "https://nba.example");
		expect(tags).toContain('<meta property="og:image" content="https://nba.example/hero/poster.jpg">');
	});
});

describe("injectOgTags", () => {
	it("replaces the title and inserts the tags before </head>", () => {
		const shell = "<html><head><title>NBA Team Builder</title></head><body></body></html>";
		const out = injectOgTags(shell, team, "https://nba.example");
		expect(out).toContain("<title>Bulls &lt;&quot;96&quot;&gt; — NBA Team Builder</title>");
		expect(out.indexOf('property="og:title"')).toBeLessThan(out.indexOf("</head>"));
		expect(out).not.toContain("<title>NBA Team Builder</title>");
	});

	it("inserts titles containing $-patterns literally instead of expanding them", () => {
		const shell = '<html><head><meta charset="UTF-8"><title>NBA Team Builder</title></head><body></body></html>';
		const out = injectOgTags(shell, { ...team, title: "Bulls $` $& $' $$ 96" }, "https://nba.example");
		expect(out).toContain("<title>Bulls $` $&amp; $&#39; $$ 96 — NBA Team Builder</title>");
		expect(out).toContain('<meta property="og:title" content="Bulls $` $&amp; $&#39; $$ 96">');
		// The shell's own markup must not have been spliced into the title.
		expect(out.match(/<meta charset="UTF-8">/g)).toHaveLength(1);
	});
});
