import { describe, it, expect } from "vitest";
import {
	PUBLIC_ROUTES,
	PRIVATE_ROUTES,
	FILES_ROUTES,
	USERS_ROUTES,
	TEAMS_ROUTES,
	DATA_ROUTES,
	NEWS_ROUTES,
	CUSTOM_ENTITIES_ROUTES,
	FEEDBACK_ROUTES,
	PUBLIC_TEAM_ROUTES,
	PAGE_ROUTES,
} from "../../service/team-builder-stack/team-builder-api-routes";

// Locks in the public/private route split team-builder-api.ts uses to
// decide which routes get the Logto authorizer attached. Tests the route
// list directly rather than instantiating TeamBuilderAPI: that construct's
// createLambdaHttpIntegration is async (dynamically imports each lambda's
// handler module) but the routing loop that calls it isn't awaited, so
// route registration doesn't complete synchronously during construction —
// a pre-existing gap unrelated to this split. Route-list correctness
// (which paths are public vs. authenticated) is fully decidable without
// touching that async path.
const PUBLIC_ROUTE_PATHS = [
	"/api/data/get-team-logos",
	"/api/data/get-players",
	"/api/data/get-player-stats",
	"/api/news/get",
	"/api/teams/public/{teamUUID}",
	"/t/{teamUUID}",
];

describe("team-builder-api-routes", () => {
	it("PUBLIC_ROUTES is exactly DATA + NEWS + PUBLIC_TEAM + PAGE routes", () => {
		const publicPaths = PUBLIC_ROUTES.map((r) => r.route).sort();
		expect(publicPaths).toEqual(PUBLIC_ROUTE_PATHS.sort());
		expect(PUBLIC_ROUTES).toHaveLength(
			DATA_ROUTES.length + NEWS_ROUTES.length + PUBLIC_TEAM_ROUTES.length + PAGE_ROUTES.length,
		);
	});

	it("PRIVATE_ROUTES covers files, users, teams, custom-entities, and feedback — nothing else", () => {
		const expectedCount =
			FILES_ROUTES.length +
			USERS_ROUTES.length +
			TEAMS_ROUTES.length +
			CUSTOM_ENTITIES_ROUTES.length +
			FEEDBACK_ROUTES.length;
		expect(PRIVATE_ROUTES).toHaveLength(expectedCount);

		for (const publicPath of PUBLIC_ROUTE_PATHS) {
			expect(PRIVATE_ROUTES.some((r) => r.route === publicPath)).toBe(
				false,
			);
		}
	});

	it("every route appears in exactly one of PUBLIC_ROUTES or PRIVATE_ROUTES", () => {
		const publicPaths = new Set(PUBLIC_ROUTES.map((r) => r.route));
		const privatePaths = new Set(PRIVATE_ROUTES.map((r) => r.route));

		for (const path of publicPaths) {
			expect(privatePaths.has(path)).toBe(false);
		}
		// 30 routes total: 27 confirmed as of the createTeam/feedback routes
		// (22 via cdk synth when the authorizer was first wired to every
		// route in commit c1e8738, plus the 4 team list/get/update/delete
		// routes added alongside createTeam, plus /api/feedback/send), plus
		// the 3 share-loop routes: /api/teams/publish, the public team
		// reader, and the OG page.
		expect(publicPaths.size + privatePaths.size).toBe(30);
	});

	it("the feedback route is private", () => {
		expect(
			PRIVATE_ROUTES.some((r) => r.route === "/api/feedback/send"),
		).toBe(true);
	});

	it("a representative write route (createTeam) is private", () => {
		expect(
			PRIVATE_ROUTES.some((r) => r.route === "/api/teams/create"),
		).toBe(true);
	});

	it("every custom-entities route is private", () => {
		for (const route of CUSTOM_ENTITIES_ROUTES) {
			expect(PRIVATE_ROUTES).toContainEqual(route);
		}
	});

	it("every team route is private", () => {
		for (const route of TEAMS_ROUTES) {
			expect(PRIVATE_ROUTES).toContainEqual(route);
		}
	});

	it("TEAMS_ROUTES has the full CRUD set with the right methods", () => {
		const byLambda = Object.fromEntries(
			TEAMS_ROUTES.map((r) => [r.lambdaName, r]),
		);
		expect(byLambda.createTeam.route).toBe("/api/teams/create");
		expect(byLambda.listTeams).toMatchObject({
			route: "/api/teams/list",
			methods: ["GET"],
		});
		expect(byLambda.getTeam).toMatchObject({
			route: "/api/teams/get/{teamUUID}",
			methods: ["GET"],
		});
		expect(byLambda.updateTeam).toMatchObject({
			route: "/api/teams/update",
			methods: ["PUT"],
		});
		expect(byLambda.deleteTeam).toMatchObject({
			route: "/api/teams/delete/{teamUUID}",
			methods: ["DELETE"],
		});
	});

	it("exposes the public team reader and the OG page without an authorizer", () => {
		const publicPaths = PUBLIC_ROUTES.map((r) => r.route);
		expect(publicPaths).toContain("/api/teams/public/{teamUUID}");
		expect(publicPaths).toContain("/t/{teamUUID}");
		expect(PAGE_ROUTES.map((r) => r.route)).toEqual(["/t/{teamUUID}"]);
	});

	it("the /t/{teamUUID} page route accepts GET and HEAD", () => {
		const pageRoute = PAGE_ROUTES.find((r) => r.route === "/t/{teamUUID}");
		expect(pageRoute?.methods).toEqual(["GET", "HEAD"]);
	});

	it("keeps publishTeam behind the authorizer", () => {
		const privatePaths = PRIVATE_ROUTES.map((r) => r.route);
		expect(privatePaths).toContain("/api/teams/publish");
		expect(PUBLIC_ROUTES.map((r) => r.route)).not.toContain("/api/teams/publish");
	});
});
