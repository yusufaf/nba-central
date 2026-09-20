# Share loop: public team pages, share cards, remix

**Date:** 2026-09-19
**Status:** approved design, not yet implemented
**Branch:** `feat/share-loop`

## Why

nba-central has no acquisition loop. Saved teams are private to their owner —
no public URL, no unfurl image, no way for a team to leave the site. The
product's moat (all-time depth + 2K ratings + coach/GM/arena + historical
logos and jerseys + custom branding) is invisible to anyone who didn't build
the team. This spec makes a saved team shareable, unfurl-able, and remixable,
and instruments the funnel so later bets (daily games) rest on data.

Product-direction research and the phase sequencing live in the plan file
referenced by the `nba-central-product-direction` memory; this spec covers
Phase 1 only.

## Decisions already made

- **Visibility:** opt-in, link-only. Owner flips a Publish toggle; anyone with
  the link can view. No gallery, no listing, no search in this phase.
- **Attribution:** the owner's Logto `username` is shown on the public page and
  the share card ("by yusufaf"). The Publish toggle copy says so.
- **OG tags** for `/t/:uuid` are served by a Lambda behind a CloudFront
  behavior, not Lambda@Edge and not an API-path share URL.
- **Share card PNG** is rendered client-side on Publish and sent to `publishTeam` as base64; the Lambda writes it to the assets bucket. Server-side rendering (satori + resvg) is the documented fallback, not the plan.
- **Out of scope** (separate PRs): `getPlayerStats` weekly snapshot; public
  gallery; comments/likes/profiles; logo file upload (currently a dead stub).

## User-facing behavior

### Publishing (owner, signed in)

1. Builder header gains a **Publish** switch next to Save. Disabled with a
   tooltip until the team has been saved at least once (needs a `teamUUID`).
2. Flipping it on:
   - renders the share card off-screen (see Share card);
   - calls `PUT /api/teams/publish { teamUUID, public: true, cardPng }` — the Lambda stores the card and returns the team with its new `cardUrl`;
   - toast "Published — link copied" and the link is on the clipboard;
   - a **Share** button appears beside the switch (copy link / native share
     sheet on mobile / download card).
3. Flipping it off calls the same endpoint with `public: false`. The page 404s
   for everyone immediately; the card object is left in place (cheap, and
   re-publishing reuses the key).
4. Saving a published team re-renders the card and re-calls publish with the
   new `cardPng` so unfurls never show a stale roster. If card rendering fails,
   the save still succeeds and the publish call sends `cardPng: null`; the
   previous `cardUrl` is kept, and a team that never had one falls back to a
   static site image for `og:image`.
5. **My Teams** (`Teams.vue`) shows a small "Public" badge on published cards
   and a copy-link icon.

### Viewing (`/t/:teamUUID`, anyone)

Read-only page, `PageShell` width, no builder chrome:

- Header: logo, team name, city/country, "by {username}", published date.
- Jersey (historical image or the owner's drawing) beside the header.
- Starting five as cards (name, position, 2K rating badge) with the same
  average-rating tier pill the builder shows; bench as a compact list.
- Coach / GM / Arena row.
- Actions: **Share** (copy link, native share), **Download card**, **Remix**.
- Footer line: "Build your own all-time franchise →" linking to `/teambuilder`.

Unpublished or unknown UUID → a friendly 404 view with the same CTA.

### Remix (anyone)

**Remix** navigates to `/teambuilder?remix=<uuid>`. The builder fetches the
team through the public endpoint, hydrates the same state `useTeamPersistence`
hydrates today, but with `loadedTeamUUID` unset — so the first Save creates a
*new* team owned by the remixer. Anonymous users can remix and edit; Save
prompts login exactly as it does today. Title is prefixed "Remix of " once.

## Data model

`SavedTeam` (both `apps/cdk/models/api/teams-api.ts` and
`apps/web/src/models/api.ts`) gains:

```ts
public: boolean;        // default false; absent on old rows == false
publishedAt?: number;   // epoch ms, set on first publish, kept on unpublish
cardUrl?: string;       // assets CDN URL of the rendered share card
```

`PlayerSnapshot`, `EntityRef`, `TeamArenaRef` are unchanged — the public page
renders the same snapshots the builder does.

### DynamoDB access path

Rows keep `PK = userUUID#<sub>`, `SK = team#<uuid>`. Of the two provisioned
GSIs, `PK3/SK3` is unused; `PK2/SK2` is already shared with news — `getNews`/
`fetchNewsCron` key it with `NEWS#<source>` partition keys, which don't
collide with this feature's `team#<uuid>` prefix. Public lookup uses that
same index:

```
PK2 = team#<teamUUID>
SK2 = "public" | "private"
```

A GSI only indexes an item when *both* its key attributes are present, so
every writer sets both: `createTeam` writes `PK2` and `SK2 = "private"`;
`updateTeam` writes `PK2` and `SK2 = if_not_exists(SK2, :private)` so a save
never silently unpublishes; `publishTeam` writes `PK2` and the requested
`SK2`. The public reader queries `PK2 = team#<uuid>` on index `PK2` and
returns 404 unless exactly one item comes back with `SK2 = "public"`.

Existing rows have neither key — they become publishable the next time they
are saved or published, so no backfill is needed.

### Public response shape

`GET /api/teams/public/{teamUUID}` returns `ApiResponse<PublicTeam>` where

```ts
type PublicTeam = Omit<SavedTeam, "userUUID" | "favorited" | "label" | "lastViewed">;
```

`username` stays. `userUUID` never leaves the API.

## API

| Route | Auth | Lambda | Notes |
|---|---|---|---|
| `GET /api/teams/public/{teamUUID}` | none (`PUBLIC_ROUTES`) | `getPublicTeam` | GSI query, 404 if not public |
| `PUT /api/teams/publish` | authorizer | `publishTeam` | `{ teamUUID, public, cardPng? }`; verifies ownership with a `GetItem` on the owner's PK/SK, uploads the card if present, then a conditional update sets `PK2`, `SK2`, `publishedAt` (first time only), `cardUrl`, `updatedAt` |
| `GET /t/{teamUUID}` | none | `getPublicTeamPage` | CloudFront behavior `/t/*` → API origin; returns HTML |

`getPublicTeamPage` is registered as a route on the HttpApi like the others but
lives outside `/api/*`. `team-builder-api-routes.ts` grows a `PAGE_ROUTES`
list so the authorizer wiring treats it as public without special-casing.

`TEAMS_ROUTES` stays private; the two new team routes are added to
`PUBLIC_ROUTES` / `PRIVATE_ROUTES` explicitly so the existing comment about
what is public remains true.

## OG page Lambda (`getPublicTeamPage`)

1. Query the team via the same GSI helper `getPublicTeam` uses (shared in
   `resources/dynamo/teams.ts`, not duplicated).
2. Load the SPA shell: `GET s3://{webBucket}/index.html`, cached in module
   scope for 5 minutes so a deploy propagates without a Lambda restart. The
   web bucket only exists in production; anywhere else the fetch fails and
   the Lambda returns a plain-text 500, which is correct — there is no site
   to serve. Tests exercise the injection logic with a fixture string.
3. Inject before `</head>`:
   - `<title>{title} — nba-central</title>`
   - `og:title`, `og:description` ("Starting five: A, B, C, D, E · Coach X ·
     by {username}"), `og:image` (`cardUrl` or `/hero/hero-poster.jpg`),
     `og:url`, `og:type=website`, `twitter:card=summary_large_image`.
   - All values HTML-escaped. Team names are user input.
4. Respond `200 text/html`, `Cache-Control: public, max-age=60,
   s-maxage=300`. Not-found or unpublished → serve the shell unmodified with
   `200` so the SPA renders its own 404 view (crawlers get no OG tags, which
   is correct).

The Lambda role needs `s3:GetObject` on the web bucket's `index.html` only.

### CloudFront

`team-builder-web.ts` adds a behavior:

```
"/t/*": { origin: apiOrigin, cachePolicy: CACHING_DISABLED,
          originRequestPolicy: ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: GET_HEAD }
```

`CACHING_DISABLED` because the response varies per team and the Lambda's
`Cache-Control` is then honored by browsers only; upgrade to a custom cache
policy keyed on the path if traffic ever warrants it.

## Share card

- `ShareCard.vue` in `src/components/TeamBuilder/share/`: a fixed 1200×630
  layout — logo, team name, city, jersey, starting five with rating badges,
  average-rating pill, "by {username}", site wordmark. Uses design tokens
  from `DESIGN.md`; no new global CSS.
- `useShareCard.ts` composable: mounts `ShareCard` in an off-screen container,
  waits for its images (`crossOrigin="anonymous"`) to settle, calls
  `html-to-image`'s `toBlob` at `pixelRatio: 1`, and returns a `Blob`.
  Images that fail to load with CORS (ESPN current-team logos are the known
  case) are swapped for a text badge before rendering rather than tainting
  the canvas.
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
- Download button on both the builder (after publish) and the public page
  fetches `cardUrl` and saves it as `{slug}.png`; no re-render.

## Frontend

- Route `/t/:teamUUID` → `views/PublicTeam.vue` (`props: true`). Add to the
  visual-test route list.
- `network/api.ts`: `teamApi.getPublicTeam(uuid)`, `teamApi.publish(payload)`.
- `stores/teams.ts`: `publish(teamUUID, public, cardUrl)` updates the cached
  summary so `Teams.vue` badges update without a refetch.
- `useTeamPersistence.ts`: `hydrateFromPublic(team)` — same mapping as today's
  hydrate minus `loadedTeamUUID`, plus the "Remix of " title prefix.
- `TeamBuilder.vue`: watch `route.query.remix` alongside `route.query.team`
  (mutually exclusive; `team` wins if both present).
- `TeamBuilderHeader.vue`: Publish switch + Share menu.
- Analytics: `src/lib/analytics.ts` exporting `track(event, data?)` that
  no-ops when `window.umami` is absent (dev, blockers). Events:
  `team_saved`, `team_published {public}`, `share_clicked {method, page}`,
  `card_downloaded {page}`, `remix_clicked`, `public_team_viewed`.

## Error handling

- Publish with no saved UUID: switch disabled; defensive guard throws before
  any network call.
- Card render failure: logged via `console.error`, toast "Published without a
  preview image", publish proceeds with `cardPng: null`.
- `publishTeam` S3 write failure: 500, toast 'Failed to publish team'; the team's visibility is unchanged because the update runs after the upload.
- `publishTeam` conditional-check failure (not owner / missing): 404, toast.
- `getPublicTeamPage` S3 miss for `index.html`: 500 with a plain-text body —
  this means the site itself is broken, not the team.
- Remix of an unpublished team: builder shows the 404 view's toast and stays
  empty.

## Testing

**cdk (vitest)**
- `getPublicTeam`: returns team for `SK2=public`; 404 for private/missing;
  strips `userUUID`, `PK*`, `SK*`.
- `publishTeam`: rejects a non-PNG or >2 MB `cardPng` with 400; uploads before
  the conditional update; 404s on a foreign team without touching S3.
- `getPublicTeamPage`: injects escaped tags into a fixture shell; falls back
  to poster when `cardUrl` missing; serves unmodified shell for unknown team.
- Stack tests: `/t/*` behavior present on the web distribution; assets CDN
  default behavior carries the managed CORS-with-preflight response headers
  policy; new routes registered and the public ones have no authorizer.

**web (vitest + Playwright)**
- `analytics.track` no-ops without `window.umami`.
- `useTeamPersistence.hydrateFromPublic` leaves `loadedTeamUUID` undefined and
  prefixes the title once.
- `PublicTeam.vue` renders roster/staff from a fixture and the 404 state.
- Visual snapshot for `/t/:uuid` (mocked API) and the builder header with the
  Publish switch in both states.

**Manual / end-to-end** (before merge)
1. Publish a team → open `/t/:uuid` in a private window → page renders.
2. Paste the link into Discord and the Twitter card validator → unfurl shows
   the card image and title.
3. Download card → PNG matches the unfurl.
4. Remix from the private window → builder loads the roster, Save prompts
   login, after login Save creates a second team under the new user.
5. Umami dashboard shows the six events.

## Rollout

1. `cdk deploy` (new Lambdas, routes, CloudFront behaviors, CORS policy).
2. Deploy web.
3. Publish one team from the owner account and run the manual checks.
Nothing here migrates existing rows; unpublished teams are unaffected.
