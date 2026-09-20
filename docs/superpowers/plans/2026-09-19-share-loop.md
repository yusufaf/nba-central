# Share Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a saved team be published to a public `/t/:uuid` page with a share-card image that unfurls on Discord/Twitter/iMessage, and let anyone remix it into their own builder.

**Architecture:** Public lookup rides the already-provisioned `PK2` GSI (`PK2 = team#<uuid>`, `SK2 = public|private`). Two new API Lambdas (`getPublicTeam`, `publishTeam`) plus one HTML Lambda (`getPublicTeamPage`) that injects OG tags into the deployed SPA shell, served through a new `/t/*` CloudFront behavior. The share card is rendered in the browser (`html-to-image`) and sent to `publishTeam` as base64; the Lambda writes it to the assets bucket and returns the CDN URL.

**Tech Stack:** AWS CDK (TypeScript), API Gateway v2, Lambda (Node), DynamoDB, S3, CloudFront; Vue 3 + Vite + Pinia + Tailwind v4 + shadcn-vue; vitest in both packages; Playwright for visual snapshots; Umami for events.

**Spec:** `docs/superpowers/specs/2026-09-19-share-loop-design.md`

## Global Constraints

- Package manager is **pnpm**; run from the repo root with `pnpm --filter <web|cdk> <script>`.
- Commits follow Conventional Commits, scoped per package: `feat(cdk): …`, `feat(web): …`, `test(cdk): …`, `docs: …`. Keep `web` and `cdk` changes in **separate commits** (release-please cuts changelogs per path).
- Pre-commit hook runs `type-check`, `check:styles` and `pnpm -r test`; it is slow (minutes) on a loaded machine — commit in the background if needed, never `--no-verify`.
- Frontend CSS: `rem` not `px`; no `!important`; no `hsla(var(--x), a)` (use `hsl(var(--x) / a)`); Tailwind classes must be real (`px-4` or `px-[1rem]`, never `px-1rem`); page width comes from `PageShell`. See `apps/web/DESIGN.md`.
- `src/components/ui/**` is vendored shadcn-vue: do not edit; use its wrappers, never `reka-ui` directly.
- Lambdas use **tabs** for indentation (match `createTeam.ts`); frontend uses 4 spaces (match `TeamBuilder.vue`).
- `public` is a **DynamoDB reserved word** — every expression touching it must alias it via `ExpressionAttributeNames` (`"#pub": "public"`).
- Visibility is opt-in, link-only; attribution shows the Logto `username`.
- Worktree: `C:\Projects\TeamBuilder\nba-central-share`, branch `feat/share-loop`.

---

## File map

**apps/cdk**
- Modify `models/api/teams-api.ts` — `SavedTeam` gains `public`, `publishedAt?`, `cardUrl?`; add `PublicTeam`, `PublishTeamPayload`, response types.
- Modify `models/stack.ts` — `ExtendedStackProps.assetsCdnDomain?`.
- Modify `service/team-builder-stack/team-builder-api-routes.ts` — add `getPublicTeam` (public), `publishTeam` (private), `PAGE_ROUTES` with `getPublicTeamPage` (public).
- Modify `service/team-builder-stack/team-builder-api.ts` — register `PAGE_ROUTES`; role gets read on the web bucket's `index.html`.
- Modify `service/team-builder-stack/team-builder.ts` — construct S3 + assets CDN before the API and pass `assetsCdnDomain`.
- Modify `service/team-builder-stack/team-builder-web.ts` — `/t/*` behavior → API origin.
- Modify `service/team-builder-stack/team-builder-assets-cdn.ts` — CORS response headers policy.
- Create `resources/dynamo/teams.ts` — GSI key helpers, `queryPublicTeam`, `toPublicTeam`.
- Create `utilities/og-html.ts` — `escapeHtml`, `buildOgTags`, `injectOgTags`.
- Modify `service/lambdas/createTeam/src/createTeam.ts`, `updateTeam/src/updateTeam.ts`, `listTeams/src/listTeams.ts`.
- Create `service/lambdas/getPublicTeam/{index.ts,src/getPublicTeam.ts}`, `publishTeam/{index.ts,src/publishTeam.ts}`, `getPublicTeamPage/{index.ts,src/getPublicTeamPage.ts}`.
- Tests: `test/lambdas/teams.test.ts`, `test/lambdas/publicTeams.test.ts` (new), `test/utilities/og-html.test.ts` (new), `test/stack/*.test.ts`.

**apps/web**
- Modify `src/models/api.ts` — mirror the model changes; `PublicTeam`, `PublishTeamPayload`.
- Modify `src/network/api.ts` — `teamApi.getPublicTeam`, `teamApi.publish`.
- Modify `src/stores/userTeams.ts` — `publish` action.
- Create `src/lib/analytics.ts` — `track()`.
- Create `src/components/TeamBuilder/share/ShareCard.vue`, `src/composables/useShareCard.ts`.
- Modify `src/components/TeamBuilder/TeamBuilderHeader.vue` — Publish/Share controls.
- Modify `src/views/TeamBuilder.vue` — publish flow, remix loading, events.
- Modify `src/composables/useTeamPersistence.ts` — `hydrateTeam` accepts `PublicTeam`; `remixTitle`.
- Create `src/views/PublicTeam.vue`; modify `src/router/index.ts`.
- Modify `src/views/Teams.vue` — Public badge + copy link.
- Modify `tests/visual/routes.spec.ts`.
- Tests under `tests/` mirroring each unit.

---

### Task 1: Amend the spec for the simplifications discovered during planning

**Files:**
- Modify: `docs/superpowers/specs/2026-09-19-share-loop-design.md`

Three spec details were superseded while mapping the code: (a) the multipart upload flow is a legacy `studysetUUID`-keyed path — a ~300 KB PNG doesn't need it, so `publishTeam` carries the card as base64 and writes S3 itself; (b) CloudFront can add CORS headers itself via a managed response-headers policy, so the assets bucket's CORS rule and cache key stay untouched; (c) the "development inline shell" fallback in the OG Lambda is unneeded — development has no site, so a missing shell is a 500.

- [ ] **Step 1: Replace the Share card upload paragraph**

Find the bullet starting `- Upload: reuse `fileApi` multipart flow` (and the sentence about the assets bucket CORS gaining PUT) and replace with:

```markdown
- Upload: `useShareCard` returns the PNG as a base64 string; the frontend
  sends it in the `publishTeam` body (`cardPng`). The Lambda verifies
  ownership, writes `cards/{teamUUID}/{updatedAt}.png` to the **assets**
  bucket with `Cache-Control: public, max-age=31536000, immutable`, and stores
  the assets-CDN URL as `cardUrl`. The key carries a timestamp so a re-save
  never serves a stale cached card; old keys are left in place. Payload cap:
  2 MB decoded (API Gateway's limit is 10 MB); the Lambda rejects anything
  that is not a PNG by magic bytes.
- **CORS on the assets CDN:** `team-builder-assets-cdn.ts` attaches the
  managed `ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT` so
  every image response carries `Access-Control-Allow-Origin: *`. The bucket's own CORS
  rule and the cache key are unchanged. Without this, every jersey/logo
  `<img>` taints the canvas.
```

- [ ] **Step 2: Replace the OG Lambda step 2**

Replace the paragraph beginning `2. Load the SPA shell:` with:

```markdown
2. Load the SPA shell: `GET s3://{webBucket}/index.html`, cached in module
   scope for 5 minutes so a deploy propagates without a Lambda restart. The
   web bucket only exists in production; anywhere else the fetch fails and
   the Lambda returns a plain-text 500, which is correct — there is no site
   to serve. Tests exercise the injection logic with a fixture string.
```

- [ ] **Step 3: Update the API table row for `publishTeam`**

Change its Notes cell to: `{ teamUUID, public, cardPng? }`; verifies ownership with a `GetItem` on the owner's PK/SK, uploads the card if present, then a conditional update sets `PK2`, `SK2`, `publishedAt` (first time only), `cardUrl`, `updatedAt`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-19-share-loop-design.md
git commit -m "docs: amend share-loop spec for base64 card upload and CDN CORS policy"
```

---

### Task 2: Backend models and route registration

**Files:**
- Modify: `apps/cdk/models/api/teams-api.ts`
- Modify: `apps/cdk/service/team-builder-stack/team-builder-api-routes.ts`
- Modify: `apps/cdk/test/stack/team-builder-api.test.ts`

**Interfaces:**
- Produces: `SavedTeam.public: boolean`, `SavedTeam.publishedAt?: number`, `SavedTeam.cardUrl?: string`; `PublicTeam`; `PublishTeamPayload`; `PublishTeamResponse`; `GetPublicTeamResponse`; `PAGE_ROUTES`; route paths `/api/teams/public/{teamUUID}`, `/api/teams/publish`, `/t/{teamUUID}`.

- [ ] **Step 1: Write the failing route-list test**

In `apps/cdk/test/stack/team-builder-api.test.ts`, add `PAGE_ROUTES` to the import and add these tests inside the existing `describe`:

```ts
	it("exposes the public team reader and the OG page without an authorizer", () => {
		const publicPaths = PUBLIC_ROUTES.map((r) => r.route);
		expect(publicPaths).toContain("/api/teams/public/{teamUUID}");
		expect(publicPaths).toContain("/t/{teamUUID}");
		expect(PAGE_ROUTES.map((r) => r.route)).toEqual(["/t/{teamUUID}"]);
	});

	it("keeps publishTeam behind the authorizer", () => {
		const privatePaths = PRIVATE_ROUTES.map((r) => r.route);
		expect(privatePaths).toContain("/api/teams/publish");
		expect(PUBLIC_ROUTES.map((r) => r.route)).not.toContain("/api/teams/publish");
	});
```

Update the existing `PUBLIC_ROUTE_PATHS` constant to include `"/api/teams/public/{teamUUID}"` and `"/t/{teamUUID}"`, and the first test's length assertion to `DATA_ROUTES.length + NEWS_ROUTES.length + PUBLIC_TEAM_ROUTES.length + PAGE_ROUTES.length` (import `PUBLIC_TEAM_ROUTES` too).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter cdk exec vitest run test/stack/team-builder-api.test.ts`
Expected: FAIL — `PAGE_ROUTES` / `PUBLIC_TEAM_ROUTES` are not exported.

- [ ] **Step 3: Add the models**

In `apps/cdk/models/api/teams-api.ts`, extend `SavedTeam` after `label: string;`:

```ts
	// Share loop (see docs/superpowers/specs/2026-09-19-share-loop-design.md).
	// `public` is opt-in and link-only; absent on rows saved before the
	// feature shipped, which readers treat as false.
	public: boolean;
	publishedAt?: number;
	cardUrl?: string;
```

Append after `DeleteTeamResponse`:

```ts
// What the anonymous `/api/teams/public/{teamUUID}` reader returns. The
// owner's `username` is deliberate attribution; `userUUID` never leaves the
// API, and the owner-only bookkeeping fields go with it.
export type PublicTeam = Omit<
	SavedTeam,
	"userUUID" | "favorited" | "label" | "lastViewed"
>;

export interface PublishTeamPayload {
	teamUUID: string;
	public: boolean;
	// Base64-encoded PNG (no data: prefix) rendered client-side. Optional so
	// unpublishing, and publishing when the render failed, still work.
	cardPng?: string | null;
}

export type PublishTeamResponse = ApiResponse<SavedTeam>;
export type GetPublicTeamResponse = ApiResponse<PublicTeam>;
```

Also update `TeamSummary` so list cards can show the badge — it is an `Omit` of `SavedTeam`, so `public` and `cardUrl` are already included; no change needed there.

- [ ] **Step 4: Register the routes**

In `team-builder-api-routes.ts`, after `TEAMS_ROUTES` add:

```ts
// Anonymous reader for published teams. Lives outside TEAMS_ROUTES so the
// "everything under /api/teams is authenticated" reading of that list stays
// true — this is the one exception, and it is opt-in per team.
export const PUBLIC_TEAM_ROUTES: ApiRoute[] = [
	{
		route: `${TEAMS_PREFIX}/public/{teamUUID}`,
		lambdaName: "getPublicTeam",
		methods: [HttpMethod.GET],
	},
];

// HTML, not JSON: CloudFront routes /t/* here so crawlers get OG tags for a
// published team before the SPA boots.
export const PAGE_ROUTES: ApiRoute[] = [
	{
		route: `/t/{teamUUID}`,
		lambdaName: "getPublicTeamPage",
		methods: [HttpMethod.GET],
	},
];
```

Add to `TEAMS_ROUTES`:

```ts
	{
		route: `${TEAMS_PREFIX}/publish`,
		lambdaName: "publishTeam",
		methods: [HttpMethod.PUT],
	},
```

Change the public/private split:

```ts
// DATA_ROUTES, NEWS_ROUTES, PUBLIC_TEAM_ROUTES and PAGE_ROUTES are read-only
// and reachable signed out — the first two are fetched on every page load,
// the last two are how a published team is viewed and unfurled. Everything
// that reads or writes user-owned data stays authenticated.
export const PUBLIC_ROUTES: ApiRoute[] = [
	...DATA_ROUTES,
	...NEWS_ROUTES,
	...PUBLIC_TEAM_ROUTES,
	...PAGE_ROUTES,
];
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter cdk exec vitest run test/stack/team-builder-api.test.ts`
Expected: PASS.

- [ ] **Step 6: Build and commit**

Run: `pnpm --filter cdk build` (tsc must be clean — `SavedTeam.public` is now required, so `createTeam.ts` will fail to compile until Task 3; if it does, add `public: false,` to `initialTeam` there now and include it in this commit).

```bash
git add apps/cdk/models/api/teams-api.ts apps/cdk/service/team-builder-stack/team-builder-api-routes.ts apps/cdk/test/stack/team-builder-api.test.ts apps/cdk/service/lambdas/createTeam/src/createTeam.ts
git commit -m "feat(cdk): add public-team models and register share-loop routes"
```

---

### Task 3: `createTeam` / `updateTeam` / `listTeams` write and project the GSI keys

**Files:**
- Create: `apps/cdk/resources/dynamo/teams.ts`
- Modify: `apps/cdk/service/lambdas/createTeam/src/createTeam.ts`
- Modify: `apps/cdk/service/lambdas/updateTeam/src/updateTeam.ts`
- Modify: `apps/cdk/service/lambdas/listTeams/src/listTeams.ts`
- Test: `apps/cdk/test/lambdas/teams.test.ts`

**Interfaces:**
- Produces: `teamGsiKey(teamUUID): string` (= `team#<uuid>`), `PUBLIC_SK2 = "public"`, `PRIVATE_SK2 = "private"` from `resources/dynamo/teams.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/cdk/test/lambdas/teams.test.ts` (import `createTeamHandler` the same way the others are imported: `const { handler: createTeamHandler } = await import("lambdas/createTeam/src/createTeam");`):

```ts
const validTeamBody = (overrides: Record<string, any> = {}) =>
	JSON.stringify({
		title: "Sharers",
		roster: [{ slot: 1, player: { fullName: "LeBron James" } }],
		coach: null,
		gm: null,
		arena: null,
		...overrides,
	});

describe("createTeam GSI keys", () => {
	it("writes PK2/SK2 so the row is indexed as private from birth", async () => {
		send.mockResolvedValueOnce({});
		const result: any = await createTeamHandler(
			authorizerEvent({ body: validTeamBody() }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(200);
		const item = send.mock.calls[0][0].input.Item;
		expect(item.PK2).toBe(`team#${item.teamUUID}`);
		expect(item.SK2).toBe("private");
		expect(item.public).toBe(false);
		const body = parseBody(result);
		expect(body.data.PK2).toBeUndefined();
		expect(body.data.SK2).toBeUndefined();
	});
});

describe("updateTeam GSI keys", () => {
	it("sets PK2 and only defaults SK2 when absent, so a save never unpublishes", async () => {
		send.mockResolvedValueOnce({ Attributes: { teamUUID: "t1", title: "x" } });
		await updateTeamHandler(
			authorizerEvent({ body: validTeamBody({ teamUUID: "t1" }) }),
			{} as any,
			{} as any,
		);
		const input = send.mock.calls[0][0].input;
		expect(input.UpdateExpression).toContain("PK2 = :pk2");
		expect(input.UpdateExpression).toContain("SK2 = if_not_exists(SK2, :sk2Default)");
		expect(input.ExpressionAttributeValues[":pk2"]).toBe("team#t1");
		expect(input.ExpressionAttributeValues[":sk2Default"]).toBe("private");
	});
});

describe("listTeams projection", () => {
	it("projects the share fields under an alias because public is reserved", async () => {
		send.mockResolvedValueOnce({ Items: [] });
		await listTeamsHandler(authorizerEvent(), {} as any, {} as any);
		const input = send.mock.calls[0][0].input;
		expect(input.ProjectionExpression).toContain("#pub");
		expect(input.ProjectionExpression).toContain("cardUrl");
		expect(input.ExpressionAttributeNames["#pub"]).toBe("public");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter cdk exec vitest run test/lambdas/teams.test.ts`
Expected: FAIL on the three new tests.

- [ ] **Step 3: Create the shared key helpers**

`apps/cdk/resources/dynamo/teams.ts`:

```ts
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { PublicTeam, SavedTeam } from "models/api/teams-api";

// Saved teams live under the owner's PK (userUUID#…). The PK2 GSI gives a
// second entry point keyed by the team alone, which is what an anonymous
// reader has. SK2 doubles as the visibility flag so the public query can
// filter at the key level rather than reading private rows and dropping
// them afterwards.
export const teamGsiKey = (teamUUID: string): string => `team#${teamUUID}`;
export const PUBLIC_SK2 = "public";
export const PRIVATE_SK2 = "private";

type StoredTeam = SavedTeam & {
	PK?: string;
	SK?: string;
	PK2?: string;
	SK2?: string;
};

// Strips the table keys and the owner-only fields. `username` stays: it is
// the attribution the share loop is built on.
export const toPublicTeam = (item: StoredTeam): PublicTeam => {
	const {
		PK: _pk,
		SK: _sk,
		PK2: _pk2,
		SK2: _sk2,
		userUUID: _userUUID,
		favorited: _favorited,
		label: _label,
		lastViewed: _lastViewed,
		...rest
	} = item;
	return rest;
};

export const queryPublicTeam = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	teamUUID: string,
): Promise<PublicTeam | null> => {
	const result = await docClient.send(
		new QueryCommand({
			TableName: tableName,
			IndexName: "PK2",
			KeyConditionExpression: "PK2 = :pk2 AND SK2 = :sk2",
			ExpressionAttributeValues: {
				":pk2": teamGsiKey(teamUUID),
				":sk2": PUBLIC_SK2,
			},
			Limit: 1,
		}),
	);
	const item = result.Items?.[0] as StoredTeam | undefined;
	return item ? toPublicTeam(item) : null;
};
```

- [ ] **Step 4: Update `createTeam`**

In `createTeam.ts` import `{ teamGsiKey, PRIVATE_SK2 } from "resources/dynamo/teams"`, change the `initialTeam` type to `SavedTeam & { PK: string; SK: string; PK2: string; SK2: string }`, and add after `SK: \`team#${teamUUID}\`,`:

```ts
			PK2: teamGsiKey(teamUUID),
			SK2: PRIVATE_SK2,
```

and after `label: "",`:

```ts
			public: false,
```

`removeKeys(initialTeam)` already strips `PK2`/`SK2` from the response.

- [ ] **Step 5: Update `updateTeam`**

Import the same helpers. Change the `UpdateExpression` to:

```ts
			UpdateExpression:
				"SET updatedAt = :updatedAt, title = :title, description = :description, " +
				"city = :city, country = :country, logoUrl = :logoUrl, jerseyUrl = :jerseyUrl, " +
				"playerCount = :playerCount, " +
				"roster = :roster, coach = :coach, gm = :gm, arena = :arena, " +
				// Rows saved before the share loop have no GSI keys; give them
				// one on the next save without touching an existing visibility.
				"PK2 = :pk2, SK2 = if_not_exists(SK2, :sk2Default)",
```

and add to `ExpressionAttributeValues`:

```ts
				":pk2": teamGsiKey(payload.teamUUID),
				":sk2Default": PRIVATE_SK2,
```

- [ ] **Step 6: Update `listTeams`**

Change the projection to:

```ts
			ProjectionExpression:
				"teamUUID, userUUID, username, title, description, city, country, logoUrl, jerseyUrl, playerCount, favorited, #lbl, lastViewed, createdAt, updatedAt, #pub, cardUrl",
			ExpressionAttributeNames: {
				"#lbl": "label",
				"#pub": "public",
			},
```

- [ ] **Step 7: Run to verify pass**

Run: `pnpm --filter cdk exec vitest run test/lambdas/teams.test.ts`
Expected: PASS (all, including the pre-existing ones).

- [ ] **Step 8: Commit**

```bash
git add apps/cdk/resources/dynamo/teams.ts apps/cdk/service/lambdas/createTeam apps/cdk/service/lambdas/updateTeam apps/cdk/service/lambdas/listTeams apps/cdk/test/lambdas/teams.test.ts
git commit -m "feat(cdk): index saved teams on the PK2 GSI for public lookup"
```

---

### Task 4: `getPublicTeam` Lambda

**Files:**
- Create: `apps/cdk/service/lambdas/getPublicTeam/index.ts`
- Create: `apps/cdk/service/lambdas/getPublicTeam/src/getPublicTeam.ts`
- Test: `apps/cdk/test/lambdas/publicTeams.test.ts`

**Interfaces:**
- Consumes: `queryPublicTeam` from Task 3.
- Produces: `GET /api/teams/public/{teamUUID}` → `GetPublicTeamResponse`; 404 `{ success:false, error:"Team not found" }` for private/missing.

- [ ] **Step 1: Write the failing tests**

`apps/cdk/test/lambdas/publicTeams.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
	return {
		...actual,
		DynamoDBDocumentClient: { from: () => ({ send }) },
	};
});

vi.mock("@aws-sdk/client-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
	return { ...actual, DynamoDBClient: vi.fn() };
});

const { handler: getPublicTeamHandler } = await import(
	"lambdas/getPublicTeam/src/getPublicTeam"
);

const parseBody = (result: any) => JSON.parse(result.body);

const anonymousEvent = (teamUUID?: string) => ({
	requestContext: {},
	pathParameters: teamUUID ? { teamUUID } : {},
	body: null,
});

const storedPublicTeam = {
	PK: "userUUID#owner",
	SK: "team#t1",
	PK2: "team#t1",
	SK2: "public",
	teamUUID: "t1",
	userUUID: "owner",
	username: "yusuf",
	title: "Sharers",
	favorited: true,
	label: "secret",
	lastViewed: 1,
	public: true,
	cardUrl: "https://cdn.example/cards/t1/1.png",
	roster: [],
};

beforeEach(() => {
	send.mockReset();
});

describe("getPublicTeam", () => {
	it("400s without a teamUUID", async () => {
		const result: any = await getPublicTeamHandler(anonymousEvent(), {} as any, {} as any);
		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("queries the PK2 index for the public row only", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		await getPublicTeamHandler(anonymousEvent("t1"), {} as any, {} as any);
		const input = send.mock.calls[0][0].input;
		expect(input.IndexName).toBe("PK2");
		expect(input.KeyConditionExpression).toBe("PK2 = :pk2 AND SK2 = :sk2");
		expect(input.ExpressionAttributeValues).toEqual({ ":pk2": "team#t1", ":sk2": "public" });
	});

	it("returns the team without keys or owner-only fields", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		const result: any = await getPublicTeamHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(result.statusCode).toBe(200);
		const { data } = parseBody(result);
		expect(data.username).toBe("yusuf");
		expect(data.cardUrl).toBe(storedPublicTeam.cardUrl);
		for (const key of ["PK", "SK", "PK2", "SK2", "userUUID", "favorited", "label", "lastViewed"]) {
			expect(data).not.toHaveProperty(key);
		}
	});

	it("404s when nothing public matches", async () => {
		send.mockResolvedValueOnce({ Items: [] });
		const result: any = await getPublicTeamHandler(anonymousEvent("nope"), {} as any, {} as any);
		expect(result.statusCode).toBe(404);
		expect(parseBody(result)).toEqual({ success: false, error: "Team not found" });
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter cdk exec vitest run test/lambdas/publicTeams.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Lambda**

`apps/cdk/service/lambdas/getPublicTeam/src/getPublicTeam.ts`:

```ts
import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetPublicTeamResponse } from "models/api/teams-api";
import { queryPublicTeam } from "resources/dynamo/teams";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Anonymous: no authorizer on this route, so there is no caller context to
// read. Visibility is enforced by the query itself (SK2 = "public").
export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const teamUUID = event.pathParameters?.teamUUID || "";
	if (!teamUUID) {
		const response: GetPublicTeamResponse = {
			success: false,
			error: "teamUUID is required",
		};
		return { statusCode: 400, body: JSON.stringify(response) };
	}

	try {
		const team = await queryPublicTeam(docClient, mainTable, teamUUID);
		if (!team) {
			const response: GetPublicTeamResponse = {
				success: false,
				error: "Team not found",
			};
			return { statusCode: 404, body: JSON.stringify(response) };
		}

		const response: GetPublicTeamResponse = { success: true, data: team };
		return {
			statusCode: 200,
			headers: { "cache-control": "public, max-age=60" },
			body: JSON.stringify(response),
		};
	} catch (err: any) {
		console.error("Error getting public team:", err);
		const response: GetPublicTeamResponse = {
			success: false,
			error: err.message || "Failed to get team",
		};
		return { statusCode: 500, body: JSON.stringify(response) };
	}
};
```

`apps/cdk/service/lambdas/getPublicTeam/index.ts` (copy of `getTeam/index.ts` with the name changed):

```ts
import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getPublicTeam";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1000,
		timeout: Duration.seconds(30),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
		},
	});

	return lambdaFunction;
};
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter cdk exec vitest run test/lambdas/publicTeams.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cdk/service/lambdas/getPublicTeam apps/cdk/test/lambdas/publicTeams.test.ts
git commit -m "feat(cdk): add anonymous getPublicTeam reader"
```

---

### Task 5: `publishTeam` Lambda with share-card upload

**Files:**
- Create: `apps/cdk/service/lambdas/publishTeam/index.ts`
- Create: `apps/cdk/service/lambdas/publishTeam/src/publishTeam.ts`
- Modify: `apps/cdk/models/stack.ts`
- Modify: `apps/cdk/service/team-builder-stack/team-builder.ts`
- Test: `apps/cdk/test/lambdas/publicTeams.test.ts`

**Interfaces:**
- Consumes: `PublishTeamPayload`, `teamGsiKey`, `PUBLIC_SK2`, `PRIVATE_SK2`.
- Produces: `PUT /api/teams/publish` → `PublishTeamResponse` (full `SavedTeam`); env vars `mainTable`, `assetsBucket`, `assetsCdnDomain`; `ExtendedStackProps.assetsCdnDomain?: string`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/cdk/test/lambdas/publicTeams.test.ts`. Add the S3 mock near the top, next to the DynamoDB mocks:

```ts
const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	return { ...actual, S3Client: vi.fn(() => ({ send: s3Send })) };
});
```

and set the env before importing the handler (module-scope reads):

```ts
process.env.assetsBucket = "team-builder-test-assets";
process.env.assetsCdnDomain = "cdn.example";
const { handler: publishTeamHandler } = await import("lambdas/publishTeam/src/publishTeam");
```

Add `s3Send.mockReset();` to `beforeEach`. Then:

```ts
// 1x1 transparent PNG — enough to pass the magic-bytes check.
const TINY_PNG_B64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const ownerEvent = (body: Record<string, unknown>) => ({
	requestContext: { authorizer: { lambda: { sub: "owner", username: "yusuf" } } },
	pathParameters: {},
	body: JSON.stringify(body),
});

describe("publishTeam", () => {
	it("400s on a malformed payload", async () => {
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: "yes" }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("404s before uploading when the caller does not own the team", async () => {
		send.mockResolvedValueOnce({}); // GetCommand: no Item
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: true, cardPng: TINY_PNG_B64 }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(404);
		expect(s3Send).not.toHaveBeenCalled();
		expect(send).toHaveBeenCalledTimes(1);
	});

	it("uploads the card to the assets bucket and flips SK2 to public", async () => {
		send.mockResolvedValueOnce({ Item: { teamUUID: "t1" } }); // ownership
		s3Send.mockResolvedValueOnce({});
		send.mockResolvedValueOnce({
			Attributes: { PK: "x", SK: "y", teamUUID: "t1", public: true, cardUrl: "u" },
		});

		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: true, cardPng: TINY_PNG_B64 }),
			{} as any,
			{} as any,
		);

		expect(result.statusCode).toBe(200);
		const put = s3Send.mock.calls[0][0].input;
		expect(put.Bucket).toBe("team-builder-test-assets");
		expect(put.Key).toMatch(/^cards\/t1\/\d+\.png$/);
		expect(put.ContentType).toBe("image/png");
		expect(put.CacheControl).toContain("immutable");

		const update = send.mock.calls[1][0].input;
		expect(update.Key).toEqual({ PK: "userUUID#owner", SK: "team#t1" });
		expect(update.ExpressionAttributeNames["#pub"]).toBe("public");
		expect(update.ExpressionAttributeValues[":sk2"]).toBe("public");
		expect(update.ExpressionAttributeValues[":pk2"]).toBe("team#t1");
		expect(update.ExpressionAttributeValues[":cardUrl"]).toBe(`https://cdn.example/${put.Key}`);
		expect(update.UpdateExpression).toContain("publishedAt = if_not_exists(publishedAt, :now)");
		expect(update.ConditionExpression).toBe("attribute_exists(PK) AND attribute_exists(SK)");

		const body = parseBody(result);
		expect(body.data.PK).toBeUndefined();
	});

	it("rejects a card that is not a PNG", async () => {
		send.mockResolvedValueOnce({ Item: { teamUUID: "t1" } });
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: true, cardPng: Buffer.from("GIF89a").toString("base64") }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(400);
		expect(s3Send).not.toHaveBeenCalled();
	});

	it("unpublishes without touching S3 or cardUrl", async () => {
		send.mockResolvedValueOnce({ Item: { teamUUID: "t1" } });
		send.mockResolvedValueOnce({ Attributes: { teamUUID: "t1", public: false } });
		const result: any = await publishTeamHandler(
			ownerEvent({ teamUUID: "t1", public: false }),
			{} as any,
			{} as any,
		);
		expect(result.statusCode).toBe(200);
		expect(s3Send).not.toHaveBeenCalled();
		const update = send.mock.calls[1][0].input;
		expect(update.ExpressionAttributeValues[":sk2"]).toBe("private");
		expect(update.UpdateExpression).not.toContain("cardUrl");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter cdk exec vitest run test/lambdas/publicTeams.test.ts`
Expected: FAIL — `lambdas/publishTeam/src/publishTeam` not found.

- [ ] **Step 3: Implement the Lambda**

`apps/cdk/service/lambdas/publishTeam/src/publishTeam.ts`:

```ts
import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AuthorizerContext } from "models/auth";
import {
	PublishTeamPayload,
	PublishTeamResponse,
	SavedTeam,
} from "models/api/teams-api";
import { removeKeys } from "resources/dynamo/utilities";
import { PRIVATE_SK2, PUBLIC_SK2, teamGsiKey } from "resources/dynamo/teams";

const { mainTable = "", assetsBucket = "", assetsCdnDomain = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

// API Gateway v2 caps the request at 10 MB; a 1200x630 card is a few hundred
// KB. Anything past this is a bug or abuse, not a bigger card.
const MAX_CARD_BYTES = 2 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const fail = (statusCode: number, error: string): APIGatewayProxyResultV2 => {
	const response: PublishTeamResponse = { success: false, error };
	return { statusCode, body: JSON.stringify(response) };
};

const parsePayload = (raw: string | undefined): PublishTeamPayload | null => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw || "{}");
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const { teamUUID, public: isPublic, cardPng } = parsed as Record<string, unknown>;
	if (typeof teamUUID !== "string" || !teamUUID || teamUUID.includes("/")) return null;
	if (typeof isPublic !== "boolean") return null;
	if (cardPng !== undefined && cardPng !== null && typeof cardPng !== "string") return null;
	return { teamUUID, public: isPublic, cardPng: cardPng as string | null | undefined };
};

const decodeCard = (cardPng: string): Buffer | null => {
	const bytes = Buffer.from(cardPng, "base64");
	if (bytes.length === 0 || bytes.length > MAX_CARD_BYTES) return null;
	if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return null;
	return bytes;
};

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event: { ...event, body: "<omitted>" }, context }, null, 4));

	const { sub: userUUID } = event.requestContext.authorizer.lambda;

	const payload = parsePayload(event.body);
	if (!payload) {
		return fail(400, "teamUUID (string) and public (boolean) are required");
	}

	const key = { PK: `userUUID#${userUUID}`, SK: `team#${payload.teamUUID}` };

	try {
		// Ownership first, so a caller can't park objects under someone
		// else's team prefix by guessing a UUID — the update below would
		// refuse, but the upload would already have happened.
		const owned = await docClient.send(
			new GetCommand({
				TableName: mainTable,
				Key: key,
				ProjectionExpression: "teamUUID",
			}),
		);
		if (!owned.Item) {
			return fail(404, "Team not found or not owned by user");
		}

		const now = new Date().getTime();
		let cardUrl: string | undefined;

		if (payload.public && payload.cardPng) {
			const bytes = decodeCard(payload.cardPng);
			if (!bytes) {
				return fail(400, "cardPng must be a PNG under 2 MB");
			}
			// Timestamped key: the CDN caches for a year, so a re-save must
			// land on a fresh URL rather than wait out the old one.
			const objectKey = `cards/${payload.teamUUID}/${now}.png`;
			await s3Client.send(
				new PutObjectCommand({
					Bucket: assetsBucket,
					Key: objectKey,
					Body: bytes,
					ContentType: "image/png",
					CacheControl: "public, max-age=31536000, immutable",
				}),
			);
			cardUrl = `https://${assetsCdnDomain}/${objectKey}`;
		}

		const setClauses = [
			"#pub = :pub",
			"PK2 = :pk2",
			"SK2 = :sk2",
			"updatedAt = :now",
			"publishedAt = if_not_exists(publishedAt, :now)",
		];
		const values: Record<string, unknown> = {
			":pub": payload.public,
			":pk2": teamGsiKey(payload.teamUUID),
			":sk2": payload.public ? PUBLIC_SK2 : PRIVATE_SK2,
			":now": now,
		};
		if (cardUrl) {
			setClauses.push("cardUrl = :cardUrl");
			values[":cardUrl"] = cardUrl;
		}

		const updated = await docClient.send(
			new UpdateCommand({
				TableName: mainTable,
				Key: key,
				UpdateExpression: `SET ${setClauses.join(", ")}`,
				ExpressionAttributeNames: { "#pub": "public" },
				ExpressionAttributeValues: values,
				ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
				ReturnValues: "ALL_NEW",
			}),
		);

		const team = updated.Attributes as SavedTeam & { PK?: string; SK?: string };
		removeKeys(team);
		const response: PublishTeamResponse = { success: true, data: team };
		return { statusCode: 200, body: JSON.stringify(response) };
	} catch (err: any) {
		console.error("Error publishing team:", err);
		if (err.name === "ConditionalCheckFailedException") {
			return fail(404, "Team not found or not owned by user");
		}
		return fail(500, err.message || "Failed to publish team");
	}
};
```

`apps/cdk/service/lambdas/publishTeam/index.ts`:

```ts
import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "publishTeam";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 1000,
		timeout: Duration.seconds(30),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			assetsBucket: `${props.appName}-${props.deploymentType}-assets`,
			// Set by team-builder.ts from the assets CloudFront distribution;
			// empty would produce "https:///cards/…" so fail loudly instead.
			assetsCdnDomain: props.assetsCdnDomain ?? "",
		},
	});

	return lambdaFunction;
};
```

- [ ] **Step 4: Thread the CDN domain through the stack**

`apps/cdk/models/stack.ts` — add to `ExtendedStackProps`:

```ts
    // Domain of the assets CloudFront distribution (no scheme). Set by
    // TeamBuilder once TeamBuilderAssetsCdn exists; Lambdas that mint asset
    // URLs (publishTeam) read it from their environment.
    assetsCdnDomain?: string;
```

`apps/cdk/service/team-builder-stack/team-builder.ts` — reorder so S3 and the CDN are created before the API, and pass the domain:

```ts
        const s3 = new TeamBuilderS3(scope, `${appName}-${deploymentType}-s3`, props);

        const assetsCdn = new TeamBuilderAssetsCdn(
            scope,
            `${appName}-${deploymentType}-assets-cdn`,
            { appName, deploymentType, assetsBucket: s3.assetsBucket },
        );

        // The API's Lambdas are built inside this constructor, so anything
        // they need in their environment has to exist first — hence S3 and
        // the assets CDN above it.
        const api = new TeamBuilderAPI(
            scope,
            `${appName}-${deploymentType}-api`,
            {
                ...props,
                assetsCdnDomain: assetsCdn.distribution.distributionDomainName,
            },
        );
        new TeamBuilderDynamoDB(
            scope,
            `${appName}-${deploymentType}-dynamoDB`,
            props
        );
```

(Delete the original `api`, `TeamBuilderDynamoDB`, `s3`, `assetsCdn` statements they replace; the `CfnOutput`s below stay as they are.)

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter cdk exec vitest run test/lambdas/publicTeams.test.ts && pnpm --filter cdk build`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add apps/cdk/service/lambdas/publishTeam apps/cdk/models/stack.ts apps/cdk/service/team-builder-stack/team-builder.ts apps/cdk/test/lambdas/publicTeams.test.ts
git commit -m "feat(cdk): add publishTeam with share-card upload to the assets CDN"
```

---

### Task 6: OG HTML helpers and the `getPublicTeamPage` Lambda

**Files:**
- Create: `apps/cdk/utilities/og-html.ts`
- Create: `apps/cdk/service/lambdas/getPublicTeamPage/index.ts`
- Create: `apps/cdk/service/lambdas/getPublicTeamPage/src/getPublicTeamPage.ts`
- Modify: `apps/cdk/constants/index.ts` (export `SITE_URL`)
- Modify: `apps/cdk/service/team-builder-stack/team-builder-api.ts` (role: web bucket read)
- Test: `apps/cdk/test/utilities/og-html.test.ts`, `apps/cdk/test/lambdas/publicTeams.test.ts`

**Interfaces:**
- Consumes: `queryPublicTeam`, `PublicTeam`, `WEB_DOMAIN_NAME` from `constants/index.ts`.
- Produces: `escapeHtml(s)`, `buildOgTags(team, siteUrl)`, `injectOgTags(shell, tags)`; `GET /t/{teamUUID}` → HTML; env `mainTable`, `webBucket`, `siteUrl`.

- [ ] **Step 1: Write the failing helper tests**

`apps/cdk/test/utilities/og-html.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter cdk exec vitest run test/utilities/og-html.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

`apps/cdk/utilities/og-html.ts`:

```ts
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
	const parts = [];
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
		.replace(/<title>[\s\S]*?<\/title>/, title)
		.replace("</head>", `${buildOgTags(team, siteUrl)}\n</head>`);
};
```

- [ ] **Step 4: Run helper tests**

Run: `pnpm --filter cdk exec vitest run test/utilities/og-html.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing Lambda tests**

Append to `apps/cdk/test/lambdas/publicTeams.test.ts`. The S3 mock from Task 5 is reused; set env before import:

```ts
process.env.webBucket = "team-builder-test-web";
process.env.siteUrl = "https://nba.example";
const { handler: pageHandler, __resetShellCache } = await import(
	"lambdas/getPublicTeamPage/src/getPublicTeamPage"
);

const SHELL = "<html><head><title>NBA Team Builder</title></head><body><div id=app></div></body></html>";
const shellObject = () => ({ Body: { transformToString: async () => SHELL } });

describe("getPublicTeamPage", () => {
	beforeEach(() => __resetShellCache());

	it("serves the shell with OG tags for a public team", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		s3Send.mockResolvedValueOnce(shellObject());
		const result: any = await pageHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(result.statusCode).toBe(200);
		expect(result.headers["content-type"]).toBe("text/html; charset=utf-8");
		expect(result.body).toContain('property="og:title" content="Sharers"');
		expect(result.body).toContain("<title>Sharers — NBA Team Builder</title>");
		expect(s3Send.mock.calls[0][0].input).toEqual({ Bucket: "team-builder-test-web", Key: "index.html" });
	});

	it("serves the untouched shell when the team is not public", async () => {
		send.mockResolvedValueOnce({ Items: [] });
		s3Send.mockResolvedValueOnce(shellObject());
		const result: any = await pageHandler(anonymousEvent("nope"), {} as any, {} as any);
		expect(result.statusCode).toBe(200);
		expect(result.body).toBe(SHELL);
	});

	it("reuses the cached shell across invocations", async () => {
		send.mockResolvedValue({ Items: [] });
		s3Send.mockResolvedValueOnce(shellObject());
		await pageHandler(anonymousEvent("a"), {} as any, {} as any);
		await pageHandler(anonymousEvent("b"), {} as any, {} as any);
		expect(s3Send).toHaveBeenCalledTimes(1);
	});

	it("500s plainly when the shell cannot be read", async () => {
		send.mockResolvedValueOnce({ Items: [storedPublicTeam] });
		s3Send.mockRejectedValueOnce(new Error("NoSuchKey"));
		const result: any = await pageHandler(anonymousEvent("t1"), {} as any, {} as any);
		expect(result.statusCode).toBe(500);
		expect(result.headers["content-type"]).toBe("text/plain; charset=utf-8");
	});
});
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm --filter cdk exec vitest run test/lambdas/publicTeams.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the Lambda**

`apps/cdk/service/lambdas/getPublicTeamPage/src/getPublicTeamPage.ts`:

```ts
import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { queryPublicTeam } from "resources/dynamo/teams";
import { injectOgTags } from "utilities/og-html";

const { mainTable = "", webBucket = "", siteUrl = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

// Crawlers don't run JavaScript, so the OG tags have to be in the HTML they
// fetch. This serves the deployed SPA shell (index.html, hashed asset URLs
// and all) with the tags injected; the browser then boots Vue exactly as it
// would from S3 and vue-router renders /t/:teamUUID.
const SHELL_TTL_MS = 5 * 60 * 1000;
let shellCache: { html: string; fetchedAt: number } | null = null;

export const __resetShellCache = () => {
	shellCache = null;
};

const loadShell = async (): Promise<string> => {
	if (shellCache && Date.now() - shellCache.fetchedAt < SHELL_TTL_MS) {
		return shellCache.html;
	}
	const object = await s3Client.send(
		new GetObjectCommand({ Bucket: webBucket, Key: "index.html" }),
	);
	const html = (await object.Body?.transformToString()) ?? "";
	shellCache = { html, fetchedAt: Date.now() };
	return html;
};

const html = (body: string): APIGatewayProxyResultV2 => ({
	statusCode: 200,
	headers: {
		"content-type": "text/html; charset=utf-8",
		"cache-control": "public, max-age=60, s-maxage=300",
	},
	body,
});

export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const teamUUID = event.pathParameters?.teamUUID || "";

	let shell: string;
	try {
		shell = await loadShell();
	} catch (err) {
		// No shell means the site itself is broken; say so instead of
		// pretending the team is missing.
		console.error("Error loading SPA shell:", err);
		return {
			statusCode: 500,
			headers: { "content-type": "text/plain; charset=utf-8" },
			body: "Site unavailable",
		};
	}

	try {
		const team = teamUUID ? await queryPublicTeam(docClient, mainTable, teamUUID) : null;
		// Unknown or private: plain shell, and the SPA shows its own 404.
		if (!team) return html(shell);
		return html(injectOgTags(shell, team, siteUrl));
	} catch (err) {
		console.error("Error building public team page:", err);
		return html(shell);
	}
};
```

`apps/cdk/service/lambdas/getPublicTeamPage/index.ts`:

```ts
import { Duration } from "aws-cdk-lib";
import { LambdaProps } from "../../../models/stack";
import { TeamBuilderLambda } from "../../constructs/TeamBuilderLambda";
import { SITE_URL } from "../../../constants";

export default ({ props, construct }: LambdaProps) => {
	const functionName = "getPublicTeamPage";
	const { lambdaFunction } = new TeamBuilderLambda(construct, functionName, {
		functionName,
		stackProps: props,
		memorySize: 512,
		timeout: Duration.seconds(10),
		environment: {
			mainTable: `${props.appName}-${props.deploymentType}-main`,
			// Name, not a construct reference: TeamBuilderWeb is created after
			// the API (and only in production). The bucket name is
			// deterministic, so the Lambda can be wired without a dependency.
			webBucket: `${props.appName}-${props.deploymentType}-web`,
			siteUrl: SITE_URL,
		},
	});

	return lambdaFunction;
};
```

In `apps/cdk/constants/index.ts`, next to `WEB_DOMAIN_NAME`, add:

```ts
export const SITE_URL = `https://${WEB_DOMAIN_NAME}`;
```

- [ ] **Step 8: Grant the role read on the shell**

In `team-builder-api.ts`, `createLambdaRoles`, after `mainLambdaRole.addToPolicy(s3PolicyStatement);` add:

```ts
		// getPublicTeamPage reads the deployed SPA shell. Scoped to that one
		// object: the web bucket is otherwise CloudFront's alone.
		mainLambdaRole.addToPolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ["s3:GetObject"],
				resources: [`arn:aws:s3:::${this.prefix}-web/index.html`],
			}),
		);
```

- [ ] **Step 9: Run tests and build**

Run: `pnpm --filter cdk exec vitest run test/lambdas/publicTeams.test.ts test/utilities/og-html.test.ts && pnpm --filter cdk build`
Expected: PASS; tsc clean.

- [ ] **Step 10: Commit**

```bash
git add apps/cdk/utilities/og-html.ts apps/cdk/service/lambdas/getPublicTeamPage apps/cdk/constants/index.ts apps/cdk/service/team-builder-stack/team-builder-api.ts apps/cdk/test/utilities/og-html.test.ts apps/cdk/test/lambdas/publicTeams.test.ts
git commit -m "feat(cdk): serve OG-tagged SPA shell for public team pages"
```

---

### Task 7: CloudFront `/t/*` behavior and assets CDN CORS

**Files:**
- Modify: `apps/cdk/service/team-builder-stack/team-builder-web.ts`
- Modify: `apps/cdk/service/team-builder-stack/team-builder-assets-cdn.ts`
- Test: `apps/cdk/test/stack/team-builder-web.test.ts`, `apps/cdk/test/stack/team-builder-assets-cdn.test.ts`

- [ ] **Step 1: Write the failing stack tests**

Append to the `describe("TeamBuilderWeb")` block in `team-builder-web.test.ts`:

```ts
	it("routes /t/* to the API origin uncached so OG pages come from the Lambda", () => {
		const config = getDistributionConfig(buildTemplate());
		const behavior = config.CacheBehaviors.find((b: any) => b.PathPattern === "/t/*");
		expect(behavior).toBeDefined();
		expect(behavior.AllowedMethods).toEqual(["GET", "HEAD"]);
		// Managed "CachingDisabled" policy id.
		expect(behavior.CachePolicyId).toBe("4135ea2d-6df8-44a3-9df3-4b5a84be39ad");
		// Managed "AllViewerExceptHostHeader" policy id.
		expect(behavior.OriginRequestPolicyId).toBe("b689b0a8-53d0-40ab-baf2-68738e2966ac");
		const apiBehavior = config.CacheBehaviors.find((b: any) => b.PathPattern === "/api/*");
		expect(behavior.TargetOriginId).toBe(apiBehavior.TargetOriginId);
	});
```

Append to `team-builder-assets-cdn.test.ts` (use whatever `buildTemplate`/config helper that file already defines):

```ts
	it("attaches the managed CORS-allow-all response headers policy", () => {
		const config = getDistributionConfig(buildTemplate());
		// Managed "CORS-with-preflight" policy id
		// (ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT).
		expect(config.DefaultCacheBehavior.ResponseHeadersPolicyId).toBe(
			"5cc3b908-e619-4b99-88e5-2cf7f45965bd",
		);
	});
```

(If that test file has no `getDistributionConfig`, copy the one from `team-builder-web.test.ts`.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter cdk exec vitest run test/stack/team-builder-web.test.ts test/stack/team-builder-assets-cdn.test.ts`
Expected: FAIL on the two new tests.

- [ ] **Step 3: Add the `/t/*` behavior**

In `team-builder-web.ts`, inside `additionalBehaviors` after the `"/api/*"` entry:

```ts
				// Public team pages. The Lambda returns index.html with OG tags
				// injected, so crawlers unfurl a published team; the browser
				// then boots the SPA from that same shell. Uncached at the edge
				// because the body varies per team.
				"/t/*": {
					origin: apiOrigin,
					viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
					cachePolicy: CachePolicy.CACHING_DISABLED,
					originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
				},
```

- [ ] **Step 4: Add the CORS policy to the assets CDN**

In `team-builder-assets-cdn.ts` import `ResponseHeadersPolicy` from `aws-cdk-lib/aws-cloudfront` and add to `defaultBehavior`:

```ts
                    // The share card is rendered in the browser from these
                    // images; without CORS headers a cross-origin <img>
                    // taints the canvas and the export fails. Managed
                    // policy: Access-Control-Allow-Origin: * on every response.
                    responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
```

Update the construct's doc comment's last paragraph to mention the policy.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter cdk exec vitest run test/stack/team-builder-web.test.ts test/stack/team-builder-assets-cdn.test.ts`
Expected: PASS. If the assets test fails on the policy id, print `config.DefaultCacheBehavior.ResponseHeadersPolicyId` and pin the test to the id CDK emits for `CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT` — the constant is what matters, the id is documentation.

- [ ] **Step 6: Synth and commit**

Run: `pnpm --filter cdk exec cdk synth --quiet` (needs `apps/cdk/.env`; expected: no errors).

```bash
git add apps/cdk/service/team-builder-stack/team-builder-web.ts apps/cdk/service/team-builder-stack/team-builder-assets-cdn.ts apps/cdk/test/stack
git commit -m "feat(cdk): route /t/* to the OG page Lambda and enable CORS on the assets CDN"
```

---

### Task 8: Frontend models, API client, and store action

**Files:**
- Modify: `apps/web/src/models/api.ts`
- Modify: `apps/web/src/network/api.ts`
- Modify: `apps/web/src/stores/userTeams.ts`
- Test: `apps/web/tests/stores/userTeams.test.ts`

**Interfaces:**
- Produces: `PublicTeam`, `PublishTeamPayload`, `PublishTeamResponse`, `GetPublicTeamResponse` (web); `teamApi.getPublicTeam(uuid)`, `teamApi.publish(payload)`; `useUserTeamsStore().publish(payload): Promise<SavedTeam>`.

- [ ] **Step 1: Write the failing store test**

In `apps/web/tests/stores/userTeams.test.ts`, add `publish: vi.fn(),` to the mocked `teamApi`, then append:

```ts
describe("useUserTeamsStore.publish", () => {
    it("returns the updated team and patches the cached summary", async () => {
        const store = useUserTeamsStore();
        store.teams = [{ teamUUID: "t1", title: "One", public: false } as any];
        vi.mocked(teamApi.publish).mockResolvedValue({
            success: true,
            data: { teamUUID: "t1", public: true, cardUrl: "https://cdn/x.png" } as any,
        });

        const saved = await store.publish({ teamUUID: "t1", public: true, cardPng: "abc" });

        expect(teamApi.publish).toHaveBeenCalledWith({ teamUUID: "t1", public: true, cardPng: "abc" });
        expect(saved.public).toBe(true);
        expect(store.teams[0]).toMatchObject({ public: true, cardUrl: "https://cdn/x.png" });
    });

    it("throws the API error message on failure", async () => {
        const store = useUserTeamsStore();
        vi.mocked(teamApi.publish).mockResolvedValue({ success: false, error: "nope" });
        await expect(store.publish({ teamUUID: "t1", public: true })).rejects.toThrow("nope");
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run tests/stores/userTeams.test.ts`
Expected: FAIL — `store.publish is not a function`.

- [ ] **Step 3: Mirror the models**

In `apps/web/src/models/api.ts`, extend `SavedTeam` (after `label: string;`):

```ts
    // Share loop: opt-in, link-only. Absent on rows saved before the feature
    // shipped, which the UI treats as false.
    public: boolean;
    publishedAt?: number;
    cardUrl?: string;
```

After `DeleteTeamResponse`:

```ts
// What /api/teams/public/{teamUUID} returns — everything the public page and
// a remix need, minus the owner's id and bookkeeping. `username` is the
// attribution.
export type PublicTeam = Omit<
    SavedTeam,
    "userUUID" | "favorited" | "label" | "lastViewed"
>;

export interface PublishTeamPayload {
    teamUUID: string;
    public: boolean;
    // Base64 PNG (no data: prefix) from useShareCard; null when the render
    // failed or when unpublishing.
    cardPng?: string | null;
}

export type PublishTeamResponse = ApiResponse<SavedTeam>;
export type GetPublicTeamResponse = ApiResponse<PublicTeam>;
```

(Check how `ApiResponse` is named/imported in this file — the existing `GetTeamResponse` uses the same shape; follow it exactly.)

- [ ] **Step 4: Extend the API client**

In `apps/web/src/network/api.ts`, add the four new types to the import list and add to `teamApi`:

```ts
    // Anonymous — no Authorization header is needed and none is required.
    getPublicTeam: async (teamUUID: string): Promise<GetPublicTeamResponse> => {
        const response = await api.get(`/api/teams/public/${teamUUID}`);
        return response.data;
    },
    publish: async (payload: PublishTeamPayload): Promise<PublishTeamResponse> => {
        const response = await api.put('/api/teams/publish', payload);
        return response.data;
    },
```

- [ ] **Step 5: Add the store action**

In `apps/web/src/stores/userTeams.ts`, import `PublishTeamPayload` and add to `actions`:

```ts
        async publish(payload: PublishTeamPayload) {
            const response = await teamApi.publish(payload);
            if (!response.success) {
                throw new Error(response.error);
            }
            // Keep /teams' badges honest without a refetch.
            const { teamUUID, public: isPublic, cardUrl } = response.data;
            this.teams = this.teams.map((t) =>
                t.teamUUID === teamUUID ? { ...t, public: isPublic, cardUrl } : t,
            );
            return response.data;
        },
```

- [ ] **Step 6: Run tests and type-check**

Run: `pnpm --filter web exec vitest run tests/stores/userTeams.test.ts && pnpm --filter web type-check`
Expected: PASS; vue-tsc clean. (If `type-check` flags fixtures that build a `SavedTeam` without `public`, add `public: false` to them.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/models/api.ts apps/web/src/network/api.ts apps/web/src/stores/userTeams.ts apps/web/tests
git commit -m "feat(web): add public-team models, API client, and publish store action"
```

---

### Task 9: Analytics helper

**Files:**
- Create: `apps/web/src/lib/analytics.ts`
- Test: `apps/web/tests/lib/analytics.test.ts`

**Interfaces:**
- Produces: `track(event: string, data?: Record<string, unknown>): void`. Event names used later: `team_saved`, `team_published`, `share_clicked`, `card_downloaded`, `remix_clicked`, `remix_loaded`, `public_team_viewed`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/lib/analytics.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { track } from "@/lib/analytics";

afterEach(() => {
    delete (window as any).umami;
});

describe("track", () => {
    it("forwards to window.umami when present", () => {
        const umamiTrack = vi.fn();
        (window as any).umami = { track: umamiTrack };
        track("share_clicked", { method: "copy" });
        expect(umamiTrack).toHaveBeenCalledWith("share_clicked", { method: "copy" });
    });

    it("is a no-op without umami (dev, blockers)", () => {
        expect(() => track("team_saved")).not.toThrow();
    });

    it("never lets a tracker error escape", () => {
        (window as any).umami = { track: () => { throw new Error("boom"); } };
        expect(() => track("team_saved")).not.toThrow();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run tests/lib/analytics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/analytics.ts`:

```ts
// Thin wrapper over the Umami tracker loaded by index.html. Umami is
// cookieless and self-hosted; `window.umami` is absent on the dev server
// and under content blockers, and analytics must never break a feature.
declare global {
    interface Window {
        umami?: {
            track: (event: string, data?: Record<string, unknown>) => void;
        };
    }
}

export const track = (event: string, data?: Record<string, unknown>): void => {
    try {
        window.umami?.track(event, data);
    } catch (err) {
        console.error("analytics.track failed:", err);
    }
};
```

- [ ] **Step 4: Run to verify pass, commit**

Run: `pnpm --filter web exec vitest run tests/lib/analytics.test.ts`
Expected: PASS.

```bash
git add apps/web/src/lib/analytics.ts apps/web/tests/lib/analytics.test.ts
git commit -m "feat(web): add Umami event helper"
```

---

### Task 10: Share card component and renderer

**Files:**
- Create: `apps/web/src/components/TeamBuilder/share/ShareCard.vue`
- Create: `apps/web/src/composables/useShareCard.ts`
- Modify: `apps/web/package.json` (dependency)
- Test: `apps/web/tests/components/ShareCard.test.ts`, `apps/web/tests/composables/useShareCard.test.ts`

**Interfaces:**
- Produces: `ShareCardProps { title, city, country, logoUrl, jerseyUrl, username, starters: ShareCardPlayer[] }` where `ShareCardPlayer = { fullName: string; position?: string; rating?: number }`; `renderShareCard(props): Promise<string>` (base64 PNG, no prefix); `toShareCardProps(team: PublicTeam): ShareCardProps`.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter web add html-to-image`
Expected: `apps/web/package.json` gains `"html-to-image": "^1.x"`; lockfile updates.

- [ ] **Step 2: Write the failing component test**

`apps/web/tests/components/ShareCard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ShareCard from "@/components/TeamBuilder/share/ShareCard.vue";

const props = {
    title: "Sharers",
    city: "Chicago",
    country: "USA",
    logoUrl: "https://cdn.example/logo.png",
    jerseyUrl: "",
    username: "yusuf",
    starters: [
        { fullName: "Michael Jordan", position: "SG", rating: 99 },
        { fullName: "Scottie Pippen", position: "SF", rating: 95 },
        { fullName: "Unrated Guy", position: "C" },
    ],
};

describe("ShareCard", () => {
    it("renders title, owner, starters and the average of rated starters", () => {
        const wrapper = mount(ShareCard, { props });
        expect(wrapper.text()).toContain("Sharers");
        expect(wrapper.text()).toContain("by yusuf");
        expect(wrapper.text()).toContain("Michael Jordan");
        expect(wrapper.text()).toContain("97"); // (99 + 95) / 2
    });

    it("loads images anonymously so the canvas export is not tainted", () => {
        const wrapper = mount(ShareCard, { props });
        const img = wrapper.find("img");
        expect(img.attributes("crossorigin")).toBe("anonymous");
    });

    it("swaps a failed logo for a monogram", async () => {
        const wrapper = mount(ShareCard, { props });
        await wrapper.find("img").trigger("error");
        expect(wrapper.find("img").exists()).toBe(false);
        expect(wrapper.text()).toContain("S"); // first letter of the title
    });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter web exec vitest run tests/components/ShareCard.test.ts`
Expected: FAIL — component not found.

- [ ] **Step 4: Implement the component**

`apps/web/src/components/TeamBuilder/share/ShareCard.vue`. Fixed 1200×630 (75rem × 39.375rem at the 16px root); only design tokens; no global CSS.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { averageRating, ratingTier } from '@/constants/ratings';

export interface ShareCardPlayer {
    fullName: string;
    position?: string;
    rating?: number;
}

export interface ShareCardProps {
    title: string;
    city: string;
    country: string;
    logoUrl: string;
    jerseyUrl: string;
    username: string;
    starters: ShareCardPlayer[];
}

const props = defineProps<ShareCardProps>();

// html-to-image re-fetches every <img>; a cross-origin image without CORS
// headers taints the canvas and the whole export fails. Images that error
// are replaced rather than left broken.
const logoFailed = ref(false);
const jerseyFailed = ref(false);

const monogram = computed(() => (props.title.trim()[0] || '?').toUpperCase());
const average = computed(() => averageRating(props.starters.map((p) => p.rating)));
const tier = computed(() => (average.value === null ? 'average' : ratingTier(average.value)));
const location = computed(() => [props.city, props.country].filter(Boolean).join(', '));
</script>

<template>
    <div
        class="share-card flex h-[39.375rem] w-[75rem] flex-col justify-between overflow-hidden bg-background p-12 text-foreground"
    >
        <header class="flex items-center gap-8">
            <img
                v-if="logoUrl && !logoFailed"
                :src="logoUrl"
                crossorigin="anonymous"
                alt=""
                class="h-32 w-32 object-contain"
                @error="logoFailed = true"
            />
            <div
                v-else
                class="flex h-32 w-32 items-center justify-center rounded-full bg-primary text-6xl font-bold text-primary-foreground"
            >
                {{ monogram }}
            </div>
            <div class="min-w-0 flex-1">
                <h1 class="truncate text-6xl font-bold leading-tight">{{ title || 'Untitled team' }}</h1>
                <p v-if="location" class="mt-2 text-3xl text-muted-foreground">{{ location }}</p>
            </div>
            <img
                v-if="jerseyUrl && !jerseyFailed"
                :src="jerseyUrl"
                crossorigin="anonymous"
                alt=""
                class="h-40 w-40 object-contain"
                @error="jerseyFailed = true"
            />
        </header>

        <ul class="grid grid-cols-5 gap-4">
            <li
                v-for="(player, i) in starters.slice(0, 5)"
                :key="i"
                class="flex flex-col justify-between rounded-lg border border-border bg-card p-4"
            >
                <span class="text-sm uppercase tracking-wide text-muted-foreground">{{ player.position || '—' }}</span>
                <span class="mt-2 line-clamp-2 text-2xl font-semibold leading-snug">{{ player.fullName }}</span>
                <span v-if="player.rating !== undefined" class="mt-3 text-3xl font-bold" :data-tier="ratingTier(player.rating)">
                    {{ player.rating }}
                </span>
            </li>
        </ul>

        <footer class="flex items-end justify-between">
            <div>
                <span class="text-xl text-muted-foreground">Starting five</span>
                <div v-if="average !== null" class="mt-1 text-5xl font-bold" :data-tier="tier">{{ average }}</div>
            </div>
            <div class="text-right">
                <div class="text-2xl">by {{ username }}</div>
                <div class="text-xl text-muted-foreground">nba.yusufaf.dev</div>
            </div>
        </footer>
    </div>
</template>

<style scoped>
/* Rating colours follow the builder's tiers; tokens come from main.css. */
[data-tier='elite'] { color: hsl(var(--primary)); }
[data-tier='great'] { color: hsl(var(--foreground)); }
[data-tier='good'],
[data-tier='average'] { color: hsl(var(--muted-foreground)); }
</style>
```

Run `pnpm --filter web check:styles` after writing it and fix anything it flags (it rejects invalid Tailwind classes and wrong token syntax).

- [ ] **Step 5: Run the component test**

Run: `pnpm --filter web exec vitest run tests/components/ShareCard.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing renderer test**

`apps/web/tests/composables/useShareCard.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("html-to-image", () => ({
    toPng: vi.fn(async () => "data:image/png;base64,QUJD"),
}));

import { toPng } from "html-to-image";
import { renderShareCard, toShareCardProps } from "@/composables/useShareCard";

describe("toShareCardProps", () => {
    it("takes starters from slots 1-5 in order and maps ratings from either player shape", () => {
        const props = toShareCardProps({
            title: "T",
            city: "C",
            country: "",
            logoUrl: "",
            jerseyUrl: "",
            username: "u",
            roster: [
                { slot: 3, player: { fullName: "Three", position: "SF", rating: 80 } },
                { slot: 6, player: { fullName: "Bench" } },
                { slot: 1, player: { fullName: "One", position: "PG", overallRating: 70, isCustom: true } },
            ],
        } as any);
        expect(props.starters.map((s) => s.fullName)).toEqual(["One", "Three"]);
        expect(props.starters[0].rating).toBe(70);
        expect(props.starters[1].rating).toBe(80);
    });
});

describe("renderShareCard", () => {
    it("mounts the card off-screen, exports at 1200x630, and cleans up", async () => {
        const before = document.body.childElementCount;
        const png = await renderShareCard({
            title: "T", city: "", country: "", logoUrl: "", jerseyUrl: "", username: "u", starters: [],
        });
        expect(png).toBe("QUJD");
        const opts = vi.mocked(toPng).mock.calls[0][1];
        expect(opts).toMatchObject({ width: 1200, height: 630, pixelRatio: 1 });
        expect(document.body.childElementCount).toBe(before);
    });
});
```

- [ ] **Step 7: Run to verify failure**

Run: `pnpm --filter web exec vitest run tests/composables/useShareCard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement the renderer**

`apps/web/src/composables/useShareCard.ts`:

```ts
import { createApp, nextTick } from 'vue';
import { toPng } from 'html-to-image';
import ShareCard from '@/components/TeamBuilder/share/ShareCard.vue';
import type { ShareCardPlayer, ShareCardProps } from '@/components/TeamBuilder/share/ShareCard.vue';
import type { PublicTeam } from '@/models/api';

const STARTER_SLOTS = [1, 2, 3, 4, 5];

// Builds card props from either a saved/public team or the builder's live
// state serialised the same way (roster entries carry player snapshots).
export const toShareCardProps = (
    team: Pick<PublicTeam, 'title' | 'city' | 'country' | 'logoUrl' | 'jerseyUrl' | 'username' | 'roster'>,
): ShareCardProps => {
    const bySlot = new Map((team.roster ?? []).map((entry) => [entry.slot, entry.player]));
    const starters: ShareCardPlayer[] = STARTER_SLOTS.flatMap((slot) => {
        const player = bySlot.get(slot);
        if (!player) return [];
        return [{
            fullName: player.fullName,
            position: player.position,
            rating: player.rating ?? player.overallRating,
        }];
    });
    return {
        title: team.title,
        city: team.city,
        country: team.country,
        logoUrl: team.logoUrl,
        jerseyUrl: team.jerseyUrl,
        username: team.username,
        starters,
    };
};

const waitForImages = async (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
        images.map(
            (img) =>
                new Promise<void>((resolve) => {
                    if (img.complete) return resolve();
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                }),
        ),
    );
    // Let the component react to any @error swaps before exporting.
    await nextTick();
};

/**
 * Renders the 1200x630 share card off-screen and returns it as base64 PNG
 * (no data: prefix), ready for publishTeam's `cardPng`. Mounts a throwaway
 * Vue app: the card is pure props, so it needs neither the router nor Pinia.
 */
export const renderShareCard = async (props: ShareCardProps): Promise<string> => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-200rem';
    host.style.top = '0';
    document.body.appendChild(host);

    const app = createApp(ShareCard, props);
    try {
        const vm = app.mount(host);
        const el = vm.$el as HTMLElement;
        await waitForImages(el);
        const dataUrl = await toPng(el, { width: 1200, height: 630, pixelRatio: 1, cacheBust: true });
        return dataUrl.replace(/^data:image\/png;base64,/, '');
    } finally {
        app.unmount();
        host.remove();
    }
};
```

- [ ] **Step 9: Run tests, styles, type-check**

Run: `pnpm --filter web exec vitest run tests/composables/useShareCard.test.ts tests/components/ShareCard.test.ts && pnpm --filter web check:styles && pnpm --filter web type-check`
Expected: all PASS/clean.

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/components/TeamBuilder/share apps/web/src/composables/useShareCard.ts apps/web/tests/components/ShareCard.test.ts apps/web/tests/composables/useShareCard.test.ts
git commit -m "feat(web): render the share card off-screen with html-to-image"
```

---

### Task 11: Publish and share controls in the builder

**Files:**
- Modify: `apps/web/src/components/TeamBuilder/TeamBuilderHeader.vue`
- Modify: `apps/web/src/views/TeamBuilder.vue`
- Test: `apps/web/tests/components/TeamBuilderHeader.test.ts` (new)

**Interfaces:**
- Consumes: `renderShareCard`, `toShareCardProps`, `useUserTeamsStore().publish`, `track`.
- Produces: `TeamBuilderHeader` props `teamUUID: string | null`, `isPublic: boolean`, `publishing: boolean`, `cardUrl: string | null`; emits `togglePublish`, `share` (`method: 'copy' | 'native'`), `downloadCard`. `TeamBuilder.vue` exposes nothing new; `shareUrlFor(teamUUID)` lives in `src/utils/shareUrl.ts` (created here) and is reused by Tasks 12 and 14.

- [ ] **Step 1: Write the failing header test**

`apps/web/tests/components/TeamBuilderHeader.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TeamBuilderHeader from "@/components/TeamBuilder/TeamBuilderHeader.vue";

const mountHeader = (props: Record<string, unknown>) =>
    mount(TeamBuilderHeader, {
        props: { teamUUID: null, isPublic: false, publishing: false, cardUrl: null, ...props },
        global: { stubs: { TeamCustomizationDialog: true, ConfirmDialog: true, DropdownMenu: true, DropdownMenuTrigger: true, DropdownMenuContent: true } },
    });

describe("TeamBuilderHeader publish controls", () => {
    it("disables Publish until the team has been saved", () => {
        const wrapper = mountHeader({});
        const button = wrapper.find('[data-testid="publish-button"]');
        expect(button.attributes("disabled")).toBeDefined();
    });

    it("emits togglePublish when enabled and clicked", async () => {
        const wrapper = mountHeader({ teamUUID: "t1" });
        await wrapper.find('[data-testid="publish-button"]').trigger("click");
        expect(wrapper.emitted("togglePublish")).toHaveLength(1);
    });

    it("shows Unpublish and the share button once public", () => {
        const wrapper = mountHeader({ teamUUID: "t1", isPublic: true });
        expect(wrapper.find('[data-testid="publish-button"]').text()).toContain("Unpublish");
        expect(wrapper.find('[data-testid="share-button"]').exists()).toBe(true);
    });

    it("hides the share button while private", () => {
        const wrapper = mountHeader({ teamUUID: "t1", isPublic: false });
        expect(wrapper.find('[data-testid="share-button"]').exists()).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run tests/components/TeamBuilderHeader.test.ts`
Expected: FAIL — no `publish-button`.

- [ ] **Step 3: Create the share URL helper**

`apps/web/src/utils/shareUrl.ts`:

```ts
// The public page lives at /t/:uuid on whatever origin served the app, so
// a dev-server link points at the dev server and production at the site.
export const shareUrlFor = (teamUUID: string): string =>
    `${window.location.origin}/t/${teamUUID}`;
```

- [ ] **Step 4: Add the controls to the header**

In `TeamBuilderHeader.vue` script, after the `defineModel` block:

```ts
const props = defineProps<{
    teamUUID: string | null;
    isPublic: boolean;
    publishing: boolean;
    cardUrl: string | null;
}>();
```

Change the emits line to:

```ts
const emit = defineEmits<{
    reset: [];
    saveTeam: [];
    togglePublish: [];
    share: [method: 'copy' | 'native'];
    downloadCard: [];
}>();
```

Add icons to the lucide import: `Globe, Link2, Share2, Download`. Add:

```ts
const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
```

In the template, inside `.action-buttons` before the Reset button:

```vue
                    <Button
                        data-testid="publish-button"
                        size="sm"
                        :variant="isPublic ? 'outline' : 'secondary'"
                        :disabled="!teamUUID || publishing"
                        :title="teamUUID ? (isPublic ? 'Make this team private' : 'Publish a public link (shows your username)') : 'Save the team first'"
                        @click="emit('togglePublish')"
                    >
                        <Globe class="h-4 w-4 mr-2" />
                        {{ publishing ? 'Working…' : isPublic ? 'Unpublish' : 'Publish' }}
                    </Button>
                    <DropdownMenu v-if="isPublic && teamUUID">
                        <DropdownMenuTrigger as-child>
                            <Button data-testid="share-button" size="sm" variant="outline" title="Share">
                                <Share2 class="h-4 w-4 mr-2" />
                                Share
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="bg-surface-raised">
                            <DropdownMenuItem @click="emit('share', 'copy')">
                                <Link2 class="h-4 w-4 mr-2" /> Copy link
                            </DropdownMenuItem>
                            <DropdownMenuItem v-if="canShareNatively" @click="emit('share', 'native')">
                                <Share2 class="h-4 w-4 mr-2" /> Share…
                            </DropdownMenuItem>
                            <DropdownMenuItem :disabled="!cardUrl" @click="emit('downloadCard')">
                                <Download class="h-4 w-4 mr-2" /> Download card
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
```

Add `DropdownMenuItem` to the `@/components/ui/dropdown-menu` import (check `src/components/ui/dropdown-menu/index.ts` exports it; it is a standard shadcn-vue export). Replace the two existing `emit('reset')`/`emit('saveTeam')` call sites — they still type-check with the typed emits.

- [ ] **Step 5: Run the header test**

Run: `pnpm --filter web exec vitest run tests/components/TeamBuilderHeader.test.ts`
Expected: PASS. Add `DropdownMenuItem: true` to the stubs if the mount warns about it.

- [ ] **Step 6: Wire the publish flow in `TeamBuilder.vue`**

Add imports:

```ts
import { useUserTeamsStore } from "@/stores/userTeams";   // if not already imported under that name
import { renderShareCard, toShareCardProps } from "@/composables/useShareCard";
import { shareUrlFor } from "@/utils/shareUrl";
import { track } from "@/lib/analytics";
```

Add state next to `loadedTeamUUID`:

```ts
// Share state for the loaded team. `teamOwner` is the Logto username the
// API stamps on a saved team; the card and the public page attribute to it.
const isPublic = ref(false);
const cardUrl = ref<string | null>(null);
const publishing = ref(false);
const teamOwner = ref("");
```

Reset them inside `clearBuilderState` (`isPublic.value = false; cardUrl.value = null; teamOwner.value = "";`). In `loadTeamFromRoute` after `loadedTeamUUID.value = response.data.teamUUID;`:

```ts
        isPublic.value = response.data.public ?? false;
        cardUrl.value = response.data.cardUrl ?? null;
        teamOwner.value = response.data.username ?? "";
```

Add the helpers below `saveTeam`:

```ts
const currentCardProps = () =>
    toShareCardProps({
        title: teamName.value,
        city: teamCity.value,
        country: teamCountry.value,
        logoUrl: teamLogo.value,
        jerseyUrl: teamJersey.value,
        username: teamOwner.value,
        roster: Array.from(selectedPlayersData.value.entries()).map(([slot, player]) => ({
            slot,
            player: { ...player, fullName: player.fullName },
        })),
    });

// A failed render must not block publishing: the page falls back to the
// site poster for og:image and the owner gets told.
const tryRenderCard = async (): Promise<string | null> => {
    try {
        return await renderShareCard(currentCardProps());
    } catch (err) {
        console.error("Share card render failed:", err);
        return null;
    }
};

const copyShareLink = async () => {
    if (!loadedTeamUUID.value) return;
    await navigator.clipboard.writeText(shareUrlFor(loadedTeamUUID.value));
};

// `silent` is the re-publish after a save of an already-public team: the
// card is refreshed so unfurls never show a stale roster, without toasting
// twice.
const setPublished = async (nextPublic: boolean, { silent = false } = {}) => {
    const teamUUID = loadedTeamUUID.value;
    if (!teamUUID) throw new Error("Cannot publish an unsaved team");
    publishing.value = true;
    try {
        const cardPng = nextPublic ? await tryRenderCard() : null;
        const saved = await userTeamsStore.publish({ teamUUID, public: nextPublic, cardPng });
        isPublic.value = saved.public;
        cardUrl.value = saved.cardUrl ?? null;
        track("team_published", { public: nextPublic, hasCard: cardPng !== null });
        if (silent) return;
        if (nextPublic) {
            await copyShareLink();
            toast.success(cardPng ? "Published — link copied" : "Published without a preview image — link copied");
        } else {
            toast.success("Team is private again");
        }
    } catch (err) {
        console.error("Publish failed:", err);
        if (!silent) toast.error(nextPublic ? "Failed to publish team" : "Failed to unpublish team");
    } finally {
        publishing.value = false;
    }
};

const togglePublish = () => setPublished(!isPublic.value);

const shareTeam = async (method: "copy" | "native") => {
    if (!loadedTeamUUID.value) return;
    const url = shareUrlFor(loadedTeamUUID.value);
    track("share_clicked", { method, page: "builder" });
    if (method === "native" && typeof navigator.share === "function") {
        try {
            await navigator.share({ title: teamName.value, url });
        } catch {
            // User dismissed the sheet — not an error.
        }
        return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
};

const downloadCard = async () => {
    if (!cardUrl.value) return;
    track("card_downloaded", { page: "builder" });
    const blob = await (await fetch(cardUrl.value)).blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${(teamName.value || "team").replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(href);
};
```

In `saveTeam`'s `toast.promise` callback, after `loadedTeamUUID.value = saved.teamUUID;`:

```ts
            teamOwner.value = saved.username ?? teamOwner.value;
            track("team_saved", { isNew: !existingUUID, playerCount: payload.roster.length });
            if (isPublic.value) {
                await setPublished(true, { silent: true });
            }
```

Bind the header:

```vue
                <TeamBuilderHeader
                    ...existing v-models...
                    :team-u-u-i-d="loadedTeamUUID"
                    :is-public="isPublic"
                    :publishing="publishing"
                    :card-url="cardUrl"
                    @saveTeam="saveTeam"
                    @reset="resetTeam"
                    @togglePublish="togglePublish"
                    @share="shareTeam"
                    @downloadCard="downloadCard"
                />
```

(Vue maps `teamUUID` to `team-u-u-i-d` in kebab-case; if that reads badly, name the prop `loadedTeamUuid` on the header instead and bind `:loaded-team-uuid` — pick one and keep the test in Step 1 consistent.)

- [ ] **Step 7: Verify in the app**

Run: `pnpm --filter web type-check && pnpm --filter web check:styles && pnpm --filter web exec vitest run`
Expected: clean. Then `pnpm --filter web start`, sign in, open a saved team, click Publish → toast, Share menu appears, clipboard has `/t/<uuid>` (the page itself is Task 12).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/TeamBuilder/TeamBuilderHeader.vue apps/web/src/views/TeamBuilder.vue apps/web/src/utils/shareUrl.ts apps/web/tests/components/TeamBuilderHeader.test.ts
git commit -m "feat(web): publish, share, and download-card controls in the builder"
```

---

### Task 12: Public team page

**Files:**
- Create: `apps/web/src/views/PublicTeam.vue`
- Modify: `apps/web/src/router/index.ts`
- Test: `apps/web/tests/views/PublicTeam.test.ts` (new dir)

**Interfaces:**
- Consumes: `teamApi.getPublicTeam`, `shareUrlFor`, `track`, `averageRating`, `ratingTier`, `PageShell`.
- Produces: route `publicTeam` at `/t/:teamUUID`; Remix navigates to `/teambuilder?remix=<uuid>` (handled in Task 13).

- [ ] **Step 1: Write the failing view test**

`apps/web/tests/views/PublicTeam.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/network/api", () => ({
    teamApi: { getPublicTeam: vi.fn() },
}));
const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import PublicTeam from "@/views/PublicTeam.vue";
import { teamApi } from "@/network/api";

const team = {
    teamUUID: "t1",
    username: "yusuf",
    title: "Sharers",
    description: "",
    city: "Chicago",
    country: "USA",
    logoUrl: "",
    jerseyUrl: "",
    playerCount: 6,
    roster: [
        { slot: 1, player: { fullName: "Michael Jordan", position: "SG", rating: 99 } },
        { slot: 6, player: { fullName: "Bench Guy" } },
    ],
    coach: { name: "Phil Jackson", isCustom: false },
    gm: null,
    arena: { name: "United Center" },
    createdAt: 1,
    updatedAt: 2,
    public: true,
    publishedAt: 2,
    cardUrl: "https://cdn/x.png",
};

const mountView = () =>
    mount(PublicTeam, {
        props: { teamUUID: "t1" },
        global: {
            stubs: {
                PageShell: { template: "<div><slot /></div>" },
                "router-link": { template: "<a><slot /></a>" },
            },
        },
    });

beforeEach(() => vi.clearAllMocks());

describe("PublicTeam", () => {
    it("renders the team, staff, and owner", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        const wrapper = mountView();
        await flushPromises();
        expect(teamApi.getPublicTeam).toHaveBeenCalledWith("t1");
        const text = wrapper.text();
        expect(text).toContain("Sharers");
        expect(text).toContain("by yusuf");
        expect(text).toContain("Michael Jordan");
        expect(text).toContain("Bench Guy");
        expect(text).toContain("Phil Jackson");
        expect(text).toContain("United Center");
    });

    it("shows the not-found state for a private or missing team", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: false, error: "Team not found" });
        const wrapper = mountView();
        await flushPromises();
        expect(wrapper.find('[data-testid="not-found"]').exists()).toBe(true);
    });

    it("remixes into the builder", async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: team as any });
        const wrapper = mountView();
        await flushPromises();
        await wrapper.find('[data-testid="remix-button"]').trigger("click");
        expect(push).toHaveBeenCalledWith({ path: "/teambuilder", query: { remix: "t1" } });
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run tests/views/PublicTeam.test.ts`
Expected: FAIL — view not found.

- [ ] **Step 3: Implement the view**

`apps/web/src/views/PublicTeam.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { Download, Link2, Share2, Sparkles } from 'lucide-vue-next';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { teamApi } from '@/network/api';
import type { PublicTeam } from '@/models/api';
import { averageRating, ratingTier } from '@/constants/ratings';
import { shareUrlFor } from '@/utils/shareUrl';
import { track } from '@/lib/analytics';

const props = defineProps<{ teamUUID: string }>();
const router = useRouter();

const team = ref<PublicTeam | null>(null);
const loading = ref(true);
const notFound = ref(false);

const STARTER_SLOTS = [1, 2, 3, 4, 5];

const bySlot = computed(() => new Map((team.value?.roster ?? []).map((e) => [e.slot, e.player])));
const starters = computed(() => STARTER_SLOTS.flatMap((s) => (bySlot.value.get(s) ? [{ slot: s, player: bySlot.value.get(s)! }] : [])));
const bench = computed(() => (team.value?.roster ?? []).filter((e) => e.slot > 5).sort((a, b) => a.slot - b.slot));
const ratingOf = (player: { rating?: number; overallRating?: number }) => player.rating ?? player.overallRating;
const average = computed(() => averageRating(starters.value.map((s) => ratingOf(s.player))));
const location = computed(() => [team.value?.city, team.value?.country].filter(Boolean).join(', '));
const publishedOn = computed(() =>
    team.value?.publishedAt ? new Date(team.value.publishedAt).toLocaleDateString() : '',
);
const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

onMounted(async () => {
    try {
        const response = await teamApi.getPublicTeam(props.teamUUID);
        if (response.success) {
            team.value = response.data;
            track('public_team_viewed', { teamUUID: props.teamUUID });
        } else {
            notFound.value = true;
        }
    } catch (err) {
        console.error('Error loading public team:', err);
        notFound.value = true;
    } finally {
        loading.value = false;
    }
});

const share = async (method: 'copy' | 'native') => {
    const url = shareUrlFor(props.teamUUID);
    track('share_clicked', { method, page: 'public' });
    if (method === 'native' && canShareNatively) {
        try {
            await navigator.share({ title: team.value?.title, url });
        } catch {
            // Dismissed.
        }
        return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
};

const downloadCard = async () => {
    if (!team.value?.cardUrl) return;
    track('card_downloaded', { page: 'public' });
    const blob = await (await fetch(team.value.cardUrl)).blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${(team.value.title || 'team').replace(/[^\w-]+/g, '-').toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(href);
};

const remix = () => {
    track('remix_clicked', { teamUUID: props.teamUUID });
    router.push({ path: '/teambuilder', query: { remix: props.teamUUID } });
};
</script>

<template>
    <main>
        <PageShell class="py-8">
            <div v-if="loading" class="text-muted-foreground">Loading team…</div>

            <div v-else-if="notFound || !team" data-testid="not-found" class="space-y-4 text-center">
                <h1 class="text-3xl font-bold">This team isn't public</h1>
                <p class="text-muted-foreground">The link may be wrong, or the owner made it private.</p>
                <Button as-child>
                    <router-link to="/teambuilder">Build your own all-time franchise →</router-link>
                </Button>
            </div>

            <article v-else class="space-y-8">
                <header class="flex flex-wrap items-center gap-6">
                    <img v-if="team.logoUrl" :src="team.logoUrl" alt="" class="h-24 w-24 object-contain" />
                    <div class="min-w-0 flex-1">
                        <h1 class="truncate text-4xl font-bold">{{ team.title }}</h1>
                        <p v-if="location" class="text-muted-foreground">{{ location }}</p>
                        <p class="text-sm text-muted-foreground">
                            by {{ team.username }}<span v-if="publishedOn"> · published {{ publishedOn }}</span>
                        </p>
                    </div>
                    <img v-if="team.jerseyUrl" :src="team.jerseyUrl" alt="" class="h-32 w-32 object-contain" />
                </header>

                <div class="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" @click="share('copy')"><Link2 class="mr-2 h-4 w-4" />Copy link</Button>
                    <Button v-if="canShareNatively" variant="outline" size="sm" @click="share('native')"><Share2 class="mr-2 h-4 w-4" />Share…</Button>
                    <Button variant="outline" size="sm" :disabled="!team.cardUrl" @click="downloadCard"><Download class="mr-2 h-4 w-4" />Download card</Button>
                    <Button data-testid="remix-button" size="sm" @click="remix"><Sparkles class="mr-2 h-4 w-4" />Remix this team</Button>
                </div>

                <section>
                    <div class="mb-3 flex items-baseline justify-between">
                        <h2 class="text-xl font-semibold">Starting five</h2>
                        <Badge v-if="average !== null" :data-tier="ratingTier(average)">Avg {{ average }}</Badge>
                    </div>
                    <ul class="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <li v-for="{ slot, player } in starters" :key="slot" class="rounded-lg border border-border bg-card p-3">
                            <div class="text-xs uppercase text-muted-foreground">{{ player.position || '—' }}</div>
                            <div class="font-semibold">{{ player.fullName }}</div>
                            <div v-if="ratingOf(player) !== undefined" class="text-lg font-bold">{{ ratingOf(player) }}</div>
                        </li>
                    </ul>
                </section>

                <section v-if="bench.length">
                    <h2 class="mb-2 text-xl font-semibold">Bench</h2>
                    <ul class="grid grid-cols-2 gap-2 md:grid-cols-5">
                        <li v-for="{ slot, player } in bench" :key="slot" class="text-sm">
                            <span class="text-muted-foreground">{{ player.position || '—' }}</span> {{ player.fullName }}
                        </li>
                    </ul>
                </section>

                <section class="grid gap-3 md:grid-cols-3">
                    <div v-if="team.coach" class="rounded-lg border border-border p-3"><div class="text-xs uppercase text-muted-foreground">Coach</div><div class="font-semibold">{{ team.coach.name }}</div></div>
                    <div v-if="team.gm" class="rounded-lg border border-border p-3"><div class="text-xs uppercase text-muted-foreground">GM</div><div class="font-semibold">{{ team.gm.name }}</div></div>
                    <div v-if="team.arena" class="rounded-lg border border-border p-3"><div class="text-xs uppercase text-muted-foreground">Arena</div><div class="font-semibold">{{ team.arena.name }}</div></div>
                </section>

                <footer class="border-t border-border pt-6 text-center">
                    <router-link to="/teambuilder" class="text-primary underline-offset-4 hover:underline">Build your own all-time franchise →</router-link>
                </footer>
            </article>
        </PageShell>
    </main>
</template>
```

Check `PageShell` import path/style against `src/views/Teams.vue` and match it. Run `check:styles`.

- [ ] **Step 4: Register the route**

In `src/router/index.ts`:

```ts
import PublicTeam from '@/views/PublicTeam.vue';
…
        {
            path: '/t/:teamUUID',
            name: 'publicTeam',
            component: PublicTeam,
            props: true,
        },
```

- [ ] **Step 5: Run tests and checks**

Run: `pnpm --filter web exec vitest run tests/views/PublicTeam.test.ts && pnpm --filter web type-check && pnpm --filter web check:styles`
Expected: PASS/clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/views/PublicTeam.vue apps/web/src/router/index.ts apps/web/tests/views/PublicTeam.test.ts
git commit -m "feat(web): add the public team page at /t/:teamUUID"
```

---

### Task 13: Remix into the builder

**Files:**
- Modify: `apps/web/src/composables/useTeamPersistence.ts`
- Modify: `apps/web/src/views/TeamBuilder.vue`
- Test: `apps/web/tests/composables/useTeamPersistence.test.ts`

**Interfaces:**
- Produces: `hydrateTeam(saved: PublicTeam)` (a `SavedTeam` still satisfies it); `remixTitle(title: string): string`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/composables/useTeamPersistence.test.ts` (add `remixTitle` to the import):

```ts
describe("remixTitle", () => {
    it("prefixes once and falls back for an empty title", () => {
        expect(remixTitle("Sharers")).toBe("Remix of Sharers");
        expect(remixTitle("Remix of Sharers")).toBe("Remix of Sharers");
        expect(remixTitle("   ")).toBe("Remix");
    });
});

describe("hydrateTeam from a public team", () => {
    it("accepts the public shape (no userUUID/favorited/label/lastViewed)", () => {
        const hydrated = hydrateTeam({
            teamUUID: "t1",
            username: "yusuf",
            title: "Sharers",
            description: "",
            city: "",
            country: "",
            logoUrl: "",
            jerseyUrl: "",
            playerCount: 1,
            roster: [{ slot: 1, player: apiPlayer() }],
            coach: null,
            gm: null,
            arena: null,
            createdAt: 1,
            updatedAt: 2,
            public: true,
        });
        expect(hydrated.teamName).toBe("Sharers");
        expect(hydrated.players.get(1)?.fullName).toBe("LeBron James");
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run tests/composables/useTeamPersistence.test.ts`
Expected: FAIL — `remixTitle` not exported (and a type error on the public shape once type-checked).

- [ ] **Step 3: Implement**

In `useTeamPersistence.ts`, change the import to include `PublicTeam`, change `hydrateTeam`'s parameter type to `PublicTeam` (its body reads only fields both shapes have), and add:

```ts
// A remix starts life as a new team owned by whoever is remixing; the
// title says where it came from, once.
export const remixTitle = (title: string): string => {
    const trimmed = title.trim();
    if (!trimmed) return "Remix";
    return trimmed.startsWith("Remix of ") ? trimmed : `Remix of ${trimmed}`;
};
```

In `TeamBuilder.vue`, import `remixTitle` and add below `loadTeamFromRoute`:

```ts
// Remixing a public team (/teambuilder?remix=<uuid>): same hydration as
// loading your own, but loadedTeamUUID stays null so the first Save
// creates a new team under the remixer. Works signed out; Save prompts
// login as it always has.
const loadRemixFromRoute = async (teamUUID: string) => {
    try {
        const response = await teamApi.getPublicTeam(teamUUID);
        if (!response.success) {
            toast.error("That team isn't public");
            return;
        }
        const hydrated = hydrateTeam(response.data);
        loadedTeamUUID.value = null;
        isPublic.value = false;
        cardUrl.value = null;
        teamOwner.value = "";
        teamName.value = remixTitle(hydrated.teamName);
        teamDescription.value = hydrated.teamDescription;
        teamCity.value = hydrated.teamCity;
        teamCountry.value = hydrated.teamCountry;
        teamLogo.value = hydrated.teamLogo;
        teamJersey.value = hydrated.teamJersey;
        teamCoach.value = hydrated.teamCoach;
        teamArena.value = hydrated.teamArena;
        teamGM.value = hydrated.teamGM;
        await Promise.all(
            Array.from(hydrated.players.entries()).map(([slot, player]) =>
                loadPlayerIntoSlot(slot, player),
            ),
        );
        track("remix_loaded", { sourceTeamUUID: teamUUID });
    } catch (err) {
        console.error("Error remixing team:", err);
        toast.error("Failed to load that team");
    }
};
```

Replace the `route.query.team` watcher with one over both params (`team` wins if both are present):

```ts
watch(
    () => [route.query.team, route.query.remix] as const,
    ([teamUUID, remixUUID]) => {
        if (typeof teamUUID === "string" && teamUUID) {
            loadTeamFromRoute(teamUUID);
        } else if (typeof remixUUID === "string" && remixUUID) {
            loadRemixFromRoute(remixUUID);
        } else {
            clearBuilderState();
        }
    },
    { immediate: true },
);
```

Also, in `saveTeam`, after the first save of a remix the URL should switch from `?remix=` to `?team=`: change the `router.replace` call to `router.replace({ query: { ...route.query, remix: undefined, team: saved.teamUUID } })`.

- [ ] **Step 4: Run tests and checks**

Run: `pnpm --filter web exec vitest run tests/composables/useTeamPersistence.test.ts && pnpm --filter web type-check`
Expected: PASS/clean.

- [ ] **Step 5: Manual check**

`pnpm --filter web start` → publish a team → open `/t/<uuid>` in a private window → Remix → builder shows "Remix of …" with the roster; Save prompts login.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/composables/useTeamPersistence.ts apps/web/src/views/TeamBuilder.vue apps/web/tests/composables/useTeamPersistence.test.ts
git commit -m "feat(web): remix a public team into a new builder session"
```

---

### Task 14: "Public" badge and copy-link on My Teams

**Files:**
- Modify: `apps/web/src/views/Teams.vue`

- [ ] **Step 1: Add the badge and button**

Import `Globe, Link2` from `lucide-vue-next`, `shareUrlFor` from `@/utils/shareUrl`, `track` from `@/lib/analytics`. In the `.team-meta` div, after the player-count badge:

```vue
                            <Badge v-if="team.public" variant="outline" class="public-badge">
                                <Globe class="h-3 w-3 mr-1" />
                                Public
                            </Badge>
```

In `.team-actions`, before the delete button:

```vue
                            <Button
                                v-if="team.public"
                                variant="outline"
                                size="icon"
                                aria-label="Copy public link"
                                @click="copyLink(team)"
                            >
                                <Link2 class="h-4 w-4" />
                            </Button>
```

Script:

```ts
const copyLink = async (team: TeamSummary) => {
    await navigator.clipboard.writeText(shareUrlFor(team.teamUUID));
    track("share_clicked", { method: "copy", page: "teams" });
    toast.success("Link copied");
};
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm --filter web type-check && pnpm --filter web check:styles`
Expected: clean. Open `/teams`; a published team shows the badge and copies its link.

```bash
git add apps/web/src/views/Teams.vue
git commit -m "feat(web): show public badge and copy link on My Teams"
```

---

### Task 15: Visual snapshots and full verification

**Files:**
- Modify: `apps/web/tests/visual/routes.spec.ts`
- Create: `apps/web/tests/visual/fixtures/public-team.json`

- [ ] **Step 1: Add a fixture and stub**

`tests/visual/fixtures/public-team.json`:

```json
{
  "success": true,
  "data": {
    "teamUUID": "visual-team",
    "username": "yusuf",
    "title": "Visual Sharers",
    "description": "",
    "city": "Chicago",
    "country": "USA",
    "logoUrl": "",
    "jerseyUrl": "",
    "playerCount": 7,
    "roster": [
      { "slot": 1, "player": { "fullName": "Michael Jordan", "position": "SG", "rating": 99 } },
      { "slot": 2, "player": { "fullName": "Scottie Pippen", "position": "SF", "rating": 95 } },
      { "slot": 3, "player": { "fullName": "Dennis Rodman", "position": "PF", "rating": 88 } },
      { "slot": 4, "player": { "fullName": "Toni Kukoc", "position": "SF", "rating": 84 } },
      { "slot": 5, "player": { "fullName": "Luc Longley", "position": "C", "rating": 76 } },
      { "slot": 6, "player": { "fullName": "Steve Kerr", "position": "PG", "rating": 78 } },
      { "slot": 7, "player": { "fullName": "Ron Harper", "position": "PG" } }
    ],
    "coach": { "name": "Phil Jackson", "isCustom": false },
    "gm": { "name": "Jerry Krause", "isCustom": false },
    "arena": { "name": "United Center" },
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000,
    "public": true,
    "publishedAt": 1700000000000
  }
}
```

In `routes.spec.ts`, import it (`import publicTeamFixture from './fixtures/public-team.json' with { type: 'json' };`) and in `stubNetwork`, **before** the `**/api/**` catch-all:

```ts
    await page.route('**/api/teams/public/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(publicTeamFixture),
        }),
    );
```

Add `/t/visual-team` to whatever route list the spec iterates, following the existing entries' shape.

- [ ] **Step 2: Generate and review the snapshot**

Run: `pnpm --filter web test:visual:update` then open `tests/visual/__screenshots__/` and look at the new image: header, five starter cards, bench, staff row, action buttons, all inside the `PageShell` gutters at both viewport sizes the suite uses.

- [ ] **Step 3: Full test pass, both packages**

Run: `pnpm -r test && pnpm --filter web build && pnpm --filter cdk build && pnpm --filter cdk exec cdk synth --quiet`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/visual
git commit -m "test(web): visual snapshot for the public team page"
```

- [ ] **Step 5: Deploy and run the manual checks from the spec**

1. `pnpm --filter cdk exec cdk diff` — expect: 3 new Lambdas, 3 new routes, one new CloudFront behavior on the web distribution, a response-headers policy on the assets distribution, one IAM statement. Then `cdk deploy`.
2. Push the branch, open a PR; merging deploys web via CI.
3. Publish one team from the owner account. Open `/t/<uuid>` signed out. Paste the link into Discord and https://cards-dev.twitter.com/validator — the unfurl must show the card. Download the card. Remix from a private window.
4. Umami: confirm `team_published`, `share_clicked`, `public_team_viewed`, `remix_clicked` arrive.

Before merging, run `/code-review` on the PR at medium effort or higher (house rule).

---

## Self-review

**Spec coverage**
- Publish toggle disabled until saved; link copied on publish; share button; unpublish → Task 11.
- Re-render card on save of a public team → Task 11 (`silent` re-publish).
- Card failure falls back to poster → Tasks 5/6/11.
- My Teams badge + copy link → Task 14.
- Public page contents, 404 view, actions, CTA → Task 12.
- Remix anonymous, `loadedTeamUUID` unset, "Remix of " once → Task 13.
- Data model fields, GSI keys, `PublicTeam` shape stripping `userUUID` → Tasks 2–4.
- API routes and auth split → Task 2; OG Lambda + shell cache + escaping + fallback → Task 6; CloudFront `/t/*` + CORS → Task 7.
- Analytics events → Tasks 9, 11, 12, 13, 14.
- Tests listed in the spec → each task; visual → Task 15; manual → Task 15 Step 5.
- Spec amendments for the simplifications → Task 1.

**Placeholder scan** — none; every code step has its code.

**Type consistency** — `PublishTeamPayload { teamUUID, public, cardPng? }` is identical in cdk and web; `PublicTeam` is the same `Omit` in both; `teamGsiKey`/`PUBLIC_SK2`/`PRIVATE_SK2` names are used the same way in Tasks 3–5; header emits `togglePublish`/`share`/`downloadCard` match the handlers bound in Task 11; `track` event names match across Tasks 9–14; `shareUrlFor` is defined in Task 11 and used in 12 and 14.
