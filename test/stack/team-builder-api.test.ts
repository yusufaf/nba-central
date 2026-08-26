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
];

describe("team-builder-api-routes", () => {
	it("PUBLIC_ROUTES is exactly DATA_ROUTES + NEWS_ROUTES", () => {
		const publicPaths = PUBLIC_ROUTES.map((r) => r.route).sort();
		expect(publicPaths).toEqual(PUBLIC_ROUTE_PATHS.sort());
		expect(PUBLIC_ROUTES).toHaveLength(
			DATA_ROUTES.length + NEWS_ROUTES.length,
		);
	});

	it("PRIVATE_ROUTES covers files, users, teams, and custom-entities — nothing else", () => {
		const expectedCount =
			FILES_ROUTES.length +
			USERS_ROUTES.length +
			TEAMS_ROUTES.length +
			CUSTOM_ENTITIES_ROUTES.length;
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
		// 22 routes total, matching the count confirmed via cdk synth when
		// the authorizer was first wired to every route (commit c1e8738).
		expect(publicPaths.size + privatePaths.size).toBe(22);
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
});
