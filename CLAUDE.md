# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo with 2 packages, managed as a pnpm workspace:
- **apps/web**: Vue 3 frontend (TypeScript)
- **apps/cdk**: AWS CDK infrastructure (TypeScript)

NBA team-building application where users create custom teams with players, coaches, arenas, and GMs. Backend is fully serverless (Lambda, DynamoDB, S3). Auth is Logto (self-hosted OIDC), not Cognito.

Each package versions and releases independently via release-please
(`web-vX.Y.Z`, `cdk-vX.Y.Z` tags) — see Release process below.

## Commands

Run from the repo root; pnpm's `--filter` scopes a command to one package.

```bash
pnpm install                    # installs both packages, one lockfile

pnpm --filter web start         # dev server on :3000
pnpm --filter web build         # production build
pnpm --filter web type-check    # vue-tsc
pnpm --filter web check:styles  # design-system guard
pnpm --filter web lint          # ESLint
pnpm --filter web render:og     # re-render the link previews: public/og-image-home.jpg, og-image-daily.png, og-image-cap-five.png (local, Playwright Chromium)

pnpm --filter cdk build         # tsc
pnpm --filter cdk test          # vitest
pnpm --filter cdk lint          # ESLint
pnpm --filter cdk exec cdk synth   # generate CloudFormation
pnpm --filter cdk exec cdk diff    # compare with deployed
pnpm --filter cdk exec cdk deploy  # deploy to AWS

pnpm --filter cdk refresh-arenas            # rewrite apps/web's arenas.json from Wikipedia
pnpm --filter cdk refresh-coaches           # rewrite coaches.json from Basketball-Reference
pnpm --filter cdk refresh-execs             # rewrite execs.json from Basketball-Reference
pnpm --filter cdk refresh-historical-logos  # rewrite historicalLogos.json, upload images to S3
pnpm --filter cdk refresh-historical-jerseys  # rewrite historicalJerseys.json, upload images to S3
pnpm --filter cdk refresh-current-logos     # rewrite currentTeamLogos.json from ESPN's teams endpoint
pnpm --filter cdk refresh-daily-era         # crop Daily Era puzzle images, append them to the puzzle list
pnpm --filter cdk refresh-team-seasons      # publish finished seasons' rosters to S3 (only seasons not yet published)
pnpm --filter cdk run refresh-<name> -- --check  # validate against the live source, write nothing
pnpm --filter cdk upload-hero-video             # upload apps/web's hero clip, rewrite heroMedia.json
pnpm --filter cdk run upload-hero-video -- --check  # validate the local file, upload nothing

pnpm -r test                    # both packages' test suites
```

Each `refresh-*` script runs the same parser as its Lambda, validates every row,
and refuses to write if anything looks wrong. Shared spine in
`apps/cdk/scripts/lib/refresh.ts`.

`apps/cdk` requires a `.env` file with: `account`, `region`, `appName`, `deploymentType`.

## Architecture

### Infrastructure (CDK) — `apps/cdk`

Main stack (`service/team-builder-stack/team-builder.ts`) instantiates:
- **TeamBuilderAPI**: API Gateway v2 HTTP API with a Lambda authorizer (verifies Logto-issued JWTs against Logto's JWKS)
- **TeamBuilderDynamoDB**: 2 tables (main, users) with GSIs
- **TeamBuilderS3**: 3 buckets (main uploads, assets, static-data)

Production also gets **TeamBuilderWeb** (S3 + CloudFront for the SPA) and **TeamBuilderDeployRole** (GitHub OIDC role for CI — its trust policy is scoped to this repo's name, see Deployment below).

TeamBuilderWeb's CloudFront distribution adds a `/t/*` behavior pointed at the
API origin (`CACHING_DISABLED`, `ALL_VIEWER_EXCEPT_HOST_HEADER`) so a request
for a published team's page reaches `getPublicTeamPage` — a shared team page
Lambda, not Lambda@Edge — before the SPA shell ships. `/api/daily/era/*` and
`/api/daily/cap-five/*` behaviors sit ahead of `/api/*` and honour the
origin's `Cache-Control` (one shared cache policy, TTLs 0/0/1h) so the daily
puzzles can be cached. `/api/scores/*` does the same with its own policy
(TTLs 0/0/1 day; see apps/cdk/CLAUDE.md). API refusals must never use
403 or 404: the distribution's error pages turn those into an edge-cached
`index.html` 200, for `/api/*` too. The assets CDN
(`TeamBuilderAssetsCdn`) attaches the managed CORS-with-preflight
response-headers policy to every response, which every jersey/logo/share-card
`<img>` needs to avoid tainting the `useShareCard` canvas render.

Entry point: `bin/team-builder-cdk.ts` loads env vars from dotenv.

### Lambda Functions — `apps/cdk/service/lambdas/*/src/`

**API Lambdas** (HTTP endpoints):
- `apiAuthorizer`: JWT verification for all API requests
- Teams CRUD: `createTeam`, `getTeam`, `listTeams`, `updateTeam`, `deleteTeam`
- Custom entities CRUD (GM/Coach/Player, each create/list/update/delete): `createCustomGM`/`createCustomCoach`/`createCustomPlayer`, and their `list*`/`update*`/`delete*` counterparts
- Custom arenas: `createCustomArena`, `listCustomArenas`, `updateCustomArena`,
  `deleteCustomArena` (deletes its images first, the item last), plus
  `uploadArenaImage`/`deleteArenaImage` for its photo, centre logo and court
  drawing slots. A team links to its owner's arena by `arenaUUID` and keeps a
  text copy; `resources/dynamo/arenas.ts` drops a link to anyone else's arena
  on save and resolves the live arena on read (spec:
  `docs/superpowers/specs/2026-10-03-custom-arenas-design.md`)
- `getUserSettings`, `updateUserSettings`: the signed-in user's settings map
  on the users table (allowlisted keys in `apps/cdk/models/user-settings.ts`)
- `exportUserData`, `deleteUserData`: everything nba-central stores for the
  signed-in user, as one JSON file or deleted (teams, custom entities,
  settings, share cards, avatar, arena images). Keyed only by the authorizer's sub; the
  Logto account is never touched
- S3 multipart upload flow: `initiateMultipartUpload`, `getMultipartSignedUploadUrls`, `completeMultipartUpload`, `deleteFile`
- `getPlayers`: player data + 2K ratings, merged from `players.json` and `player-ratings.json`;
  `ids=a,b,c` (up to 20) returns just those players in that order, ignoring
  every other filter. Each player's `team` is the ESPN roster they are on in
  `live/headshots.json` (empty when on none), so a trade shows within about a
  day of `setSeasonContextData`'s roster rebuild; production only, since no
  other stack has that file
- `getPlayerStats`: one player's career from the stats snapshot (main table,
  PK `PLAYERSTATS`) plus their 2K rating; never calls Basketball-Reference,
  and answers `available: false` for a player the snapshot hasn't reached
- `getNews`: reads news articles fetched by `fetchNewsCron`
- `sendFeedback`: emails the site owner via SES (sending identity is in
  us-east-1, not this stack's own us-west-2 — see apps/cdk/CLAUDE.md)
- `getPublicTeam`: anonymous reader for a published team, keyed off the PK2 GSI
- `publishTeam`: flips a team's visibility, uploads the rendered share card to
  the assets bucket, and stamps `cardUrl`/`publishedAt`
- `getPublicTeamPage`: serves `/t/{teamUUID}` — the SPA shell with the
  team's description, canonical and OG/Twitter tags for crawlers, behind the
  CloudFront `/t/*` behavior. It strips the shell's site-wide defaults first
  (`apps/cdk/utilities/og-html.ts`); an unknown or private team gets the
  stripped shell marked `noindex`, and a failed lookup a no-store 503. A new
  default tag in `apps/web/index.html`'s head has to be handled in
  `og-html.ts` too — `og-html.test.ts` checks every head tag of the real file
- `getDailyEra`, `guessDailyEra`: the Daily Era game. The first returns a
  date's puzzle number, opaque id and image URL (never the answer); the
  second scores a season guess and reveals the answer only on a hit or the
  4th attempt. Both read `daily-era-puzzles.json` from static-data and keep
  no state (spec: `docs/superpowers/specs/2026-10-14-daily-era-design.md`)
- `getScoreboardDay`, `getScoreboardMonth`, `getGameSummary`: `/api/scores/*`,
  ESPN's day scoreboard, a month's game dates and a game's box score,
  fetched server-side and cached at CloudFront by game state, so no browser
  calls ESPN for `/scores` or `/game/:id` (see apps/cdk/CLAUDE.md)
- `getCapFive`, `submitCapFive`: the Cap Five game. The first returns a
  date's pool of 12 players and the rating cap (never a rating); the second
  scores a five-player lineup and reveals every rating and the optimal. Both
  read that date's `cap-five/<date>.json` from static-data and keep no state
  (spec: `docs/superpowers/specs/2026-10-22-cap-five-design.md`)

**Data ETL Lambdas** (EventBridge triggers):
- `setPlayersData`, `setPlayerRatingsData`: scrape Basketball-Reference / api.nba2kapi.com;
  `setPlayersData` also adds the latest draft class (same BBRef ids, no bio
  fields) so rookies are searchable before their first game. After
  `players.json` it writes the current season's team rosters to
  `live/team-seasons/current.json` in the assets bucket (3 more BBRef pages:
  `headshots.json` says who is on each roster, the season's per-game page
  orders them); a failure there only keeps the previous file. `setPlayersData`
  runs Mondays 10:14 UTC, in the gap between two snapshot runs; test-invoke
  it by hand only between :13 and :19 (or :33-:39, :53-:59), since it takes
  no lock
- `setPlayerStatsData` (every 20 min): scrapes the Basketball-Reference
  careers that are due into that snapshot, ~17 requests a minute, and no
  request past 12 minutes into its :00/:20/:40 slot: missing players first,
  current players weekly, everyone else every 90 days. A 429/403 or a page
  without player info pauses it for a day (one of those two from a player
  whose last error was also one of them counts as an ordinary failure,
  retried daily; a 429 always pauses), and only one run goes at a
  time; it never stores a career that fails validation or has fewer seasons
  than the stored one
- `fetchNewsCron`: pulls ESPN, Bluesky, CBS Sports, and RealGM into the news table
- `publishCapFive` (daily): freezes every playable Cap Five date, up to a
  week ahead, from the current `player-ratings.json` into its own
  `cap-five/<date>.json`, written with `IfNoneMatch` so a published day never
  changes. It bundles its own AWS SDK so that condition can't be dropped by
  an older runtime SDK, and publishes nothing if fewer than 300 players are
  eligible. Its schedule first fires a day after the rule is created, so
  invoke it once by hand after the deploy that creates it, or `/cap-five`
  has no puzzle until then
- `setSeasonContextData` (hourly at :07, production only): copies ESPN's
  standings and a week of schedule into `live/standings.json` and
  `live/schedule.json` in the assets bucket, served by the assets CDN's
  `live/*` behavior (5-minute TTL, `stale-if-error`). Once a day it joins
  ESPN's rosters to the BBRef players with the ratings matcher
  (`utilities/player-names.ts`) into `live/headshots.json`, and it mirrors
  their headshots to `live/headshots/{espnId}.png`, 100 a run. Every dataset is
  validated on its own, and one that fails or shrinks sharply keeps its
  previous file. It is the only thing that calls ESPN for this data: the web
  reads the files, never ESPN

Arenas, coaches, execs, the current team logos and the historical logos/jerseys have no Lambda: the
bundled JSON in `apps/web/src/assets/data/` is their only copy, and the
`refresh-*` scripts in `apps/cdk` are its only writers (see Frontend below).

Lambda layers: `node-fetch_cheerio`, `node-fetch_jsdom` for web scraping.

### Frontend (Vue 3) — `apps/web`

Stack: Vite + Vue Router + Pinia + Tailwind v4 + reka-ui/shadcn-vue + Axios

There is **no Quasar** — it was removed after `6ff4e75`, and no dependency,
config or `<q-*>` component remains.

For anything touching the UI, read `apps/web/CLAUDE.md` and
`apps/web/DESIGN.md` first. They carry the design tokens, the layout rules,
and the constraints enforced by `pnpm --filter web check:styles`.

**Key Directories** (all under `apps/web/`):
- `src/views/`: Page components (Home, TeamBuilder, Scores, Standings, News, Teams, PublicTeam, DailyEra, CapFive, Settings, Login, SignUp)
- `src/layouts/`: `PageShell` — the single page container (width + gutters)
- `src/components/ui/`: vendored shadcn-vue wrappers over reka-ui primitives
- `src/components/TeamBuilder/`: Feature components (CoachSection, ArenaSection, etc.)
- `src/network/api.ts`: Axios client with API methods (fileApi, settingsApi, teamApi, dataApi)
- `src/stores/`: Pinia stores (userTeams.ts)
- `src/models/`: TypeScript types (types.ts, api.ts)
- `src/assets/data/`: Static JSON (coaches, arenas, execs, countries, currentTeamLogos, historicalLogos, historicalJerseys)

These files are imported directly, not fetched — they are small and change rarely,
so a request would cost more than it saves. Players moved to an API (`getPlayers`)
because that dataset is large and needs search/filter. `arenas.json`, `coaches.json`,
`execs.json`, `currentTeamLogos.json`, `historicalLogos.json` and
`historicalJerseys.json` are all
regenerated by their `refresh-*` scripts in `apps/cdk`, which are the only
writers: there is no Lambda or S3 copy of any of them. Their parsers live in
`apps/cdk/scripts/lib/`. Regenerating is a deliberate, reviewable step — do
not hand-edit them.

`historicalLogos.json` is generated by `pnpm --filter cdk refresh-historical-logos`,
which crawls every NBA/BAA/ABA franchise Basketball-Reference tracks and hashes
each season's logo image to collapse ~1,700 team-seasons into a few hundred
distinct logo eras. The PNGs themselves are *not* checked in: the script
uploads one per era to the `assets` S3 bucket under a content-hashed key and
each row's `logo` field is the full CloudFront URL, so ~230 images stay out of
both the repo and Vite's import graph. There is no Lambda for
this dataset — it changes roughly once a decade per franchise, and 1,700+
requests don't fit a Lambda timeout — so it is script-only, unlike the other
three.

Basketball-Reference serves those logos as 125×125 palette PNGs with an opaque
white background, which reads as a white square on the dark theme. The refresh
script keys that background out as it downloads (`apps/cdk/scripts/lib/pngAlpha.ts`:
flood-fill inward from the border so white *inside* the artwork survives, then
remap to a `tRNS` palette entry — node's builtin `zlib`, no image library).
A keying change only reaches browsers after bumping `LOGO_KEYING_VERSION` in
`apps/cdk/scripts/lib/historicalLogos.ts` and re-running the refresh — the
S3 keys hash the source image plus that version, not the keyed output.

`historicalJerseys.json` is generated by `pnpm --filter cdk refresh-historical-jerseys`,
which crawls the Basketball Jersey Database (bballjerseys.com) for every
team's and All-Star game's jersey designs since 1946-47, trimmed to home/road
and primary alternates (one-off Christmas/City/commemorative designs are
dropped). As with historicalLogos, the images are *not* checked into the repo
— each row's `jersey` field points at a CloudFront URL. That CDN fronts the
`assets` S3 bucket via `TeamBuilderAssetsCdn`; uploading requires `cdk deploy`
first (see apps/cdk/CLAUDE.md).

`pnpm --filter cdk refresh-daily-era` turns the home/road jerseys into Daily
Era puzzle images: it crops away the year labels, watermark, era caption and
handle, merges look-alike jerseys into one puzzle, and uploads each image to
the `assets` bucket under a random key (`daily-era/<16 chars>.webp`), so the
URL never names the answer. The puzzle list, `daily-era-puzzles.json`, lives
in the `static-data` bucket, not the bundle, because it holds the answers; it
is append-only. Run it with `--check` first and review the contact sheet it
writes to `apps/cdk/daily-era-review/`.

The game itself is `/daily` (`src/views/DailyEra.vue`, state in
`useDailyEra`), linked from the header's Daily menu (`DAILY_GAMES` in
`src/constants/constants.ts`) and listed in `public/sitemap.xml`. A new daily
game needs both, plus its route's `indexable`. Each day's game is kept in
localStorage per local date, so a reload resumes it. Its reveal links to
`/teambuilder?jersey=<mediaId>`, which opens a blank team wearing that
historical jersey.

The second daily game is `/cap-five` (`src/views/CapFive.vue`, state in
`useCapFive`), linked and indexed the same way: pick five of the day's
twelve players under a rating cap, with ratings hidden until the lineup is
locked in. One result per local date is kept in localStorage, and the first
submission wins. Its share text and card never name a player. Like `/daily`,
it has its own copy of the shell (`dist/cap-five.html`, from
`build/capFiveHtml.ts`) so a pasted link unfurls with its own tags and image.

`currentTeamLogos.json` is generated by `pnpm --filter cdk refresh-current-logos`,
one request to ESPN's public teams endpoint. It holds the 30 current teams'
`{ name, logo }` rows for the logo dialog's Current tab, which used to fetch
them from the visitor's browser on every `/teambuilder` mount. The `logo`
values are still `a.espncdn.com` URLs that the dialog hotlinks when it opens
(saved teams store the same URLs); only the list is bundled.

**Dev Server**: Vite proxy forwards `/api` to `http://127.0.0.1:8000` (must use 127.0.0.1, not localhost).

**Path Alias**: `@` → `src/`

### Authentication Flow

Auth is [Logto](https://logto.io) (self-hosted OIDC, `auth.yusufaf.dev`) — a
shared identity provider also used by Quizaroni. No Cognito, no Clerk.

1. Frontend redirects to Logto's hosted sign-in page (`@logto/vue`'s `signIn()`)
2. Logto redirects back to `/callback`, which exchanges the code for an
   access token scoped to the `VITE_LOGTO_API_RESOURCE` audience
3. Frontend sends the access token in the `Authorization` header
4. `apiAuthorizer` Lambda verifies the JWT against Logto's JWKS
   (`createRemoteJWKSet`, cached in module scope — no network call on a warm
   invocation) and extracts `sub`/`username` into the authorizer context
5. Downstream Lambdas receive that context via
   `event.requestContext.authorizer.lambda`

A handful of routes (`/api/data/*`, `/api/news/get`,
`/api/teams/public/{teamUUID}`, `/t/{teamUUID}`, `/api/daily/era/*`,
`/api/daily/cap-five/*`, `/api/scores/*`) skip the authorizer entirely — the
first two serve every visitor, signed in or not; the next two are how a
published team is viewed and unfurled by anyone, including crawlers with no
session at all; the next two are the daily games, which need no account; the
last backs the scores pages.

### Data Models

Key types in `apps/web/src/models/types.ts`:
- `Team`: {uuid, name, description, players[]}
- `Coach`: {name, championships, G, W, L, playoffStats...}
- `Arena`: {name, location, team, capacity, openedYear}
- `GM`: {name, teams[]}

### DynamoDB Schema

2 tables:
- **main**: PK + SK + 2 GSIs for teams/metadata
- **users**: PK + SK for user data

Partition key patterns use UUIDs (userUUID#..., teamUUID#...).

### S3 Buckets

- **main**: User/team file uploads (multipart for large files)
- **assets**: Static assets; also holds rendered share cards under `cards/`
  (`publishTeam` writes them, keyed `cards/{teamUUID}/{updatedAt}.png`) and
  custom arena images under `arenas/{arenaUUID}/{slot}-{ms}.{ext}` (keyed by
  the arena, never the owner, so a public URL doesn't say whose it is), and
  Daily Era puzzle images under `daily-era/` (random keys, see `refresh-daily-era`),
  and the live season files under `live/` (`setSeasonContextData` writes
  them; old versions expire after 7 days), and the team-season rosters:
  finished seasons under `team-seasons/{L}-{Y}.json` with their index at
  `live/team-seasons/index.json` (`refresh-team-seasons`, run by hand once a
  season ends), the current season at `live/team-seasons/current.json`
  (`setPlayersData`, weekly)
- **static-data**: External data cache (`players.json`, `player-ratings.json`),
  the private Daily Era puzzle list (`daily-era-puzzles.json`) and the Cap
  Five puzzles (`cap-five/<date>.json`, one per day, immutable, written only
  by `publishCapFive`)

All CORS-enabled, public access blocked.

## Development Workflow

1. **CDK changes**: Edit in `apps/cdk/`, run `pnpm --filter cdk build`, `pnpm --filter cdk exec cdk synth`, `pnpm --filter cdk exec cdk diff`, `pnpm --filter cdk exec cdk deploy`
2. **Lambda changes**: Edit in `apps/cdk/service/lambdas/*/src/`, CDK handles bundling via esbuild
3. **Frontend changes**: Edit in `apps/web/src/`, dev server hot-reloads
4. **API integration**: Update `apps/web/src/network/api.ts` for new endpoints
5. **Type changes**: Update both CDK models and frontend models
6. **Committing**: one PR can touch both packages, but keep unrelated `web`/`cdk`
   changes in separate commits — release-please cuts a changelog entry per
   commit, scoped to whichever package's paths it touched

## Key Files

- `apps/cdk/bin/team-builder-cdk.ts`: CDK entry point
- `apps/cdk/service/team-builder-stack/team-builder.ts`: Main construct
- `apps/cdk/service/lambdas/apiAuthorizer/src/apiAuthorizer.ts`: Auth logic
- `apps/web/src/network/api.ts`: API client
- `apps/web/src/views/TeamBuilder.vue`: Core feature component
- `apps/web/src/router/index.ts`: Route definitions
- `apps/web/vite.config.ts`: Vite config with proxy

## Deployment

Deployment controlled by env vars:
- `deploymentType`: "development" or "production"
- `appName`: "team-builder"
- `account`, `region`: AWS account/region

Resource naming: `{appName}-{deploymentType}-{resource}` (e.g., "team-builder-development-api")

The GitHub Actions deploy role's OIDC trust policy is scoped to this exact
repo name (`githubRepo` in `team-builder-deploy-role.ts`, currently
`yusufaf/nba-central`) — renaming the repo requires updating that constant and
redeploying the production stack *before* the rename, or CI deploys break in
the gap.

### PR previews

`.github/workflows/preview.yml` builds `apps/web` for every same-repo PR that
touches it and publishes it with `rossjrw/pr-preview-action` to the `gh-pages`
branch, served by GitHub Pages at
`https://yusufaf.dev/nba-central/pr-preview/pr-<N>/` (project Pages ride on the
user site's custom domain). `preview-cleanup.yml` removes the folder when the
PR closes. A preview build (`VITE_PREVIEW=1`, `src/utils/preview.ts`):

- routes with hash history (`.../pr-<N>/#/teambuilder`): Pages has no SPA
  fallback inside a subfolder
- calls the **development** API (repo variable `PREVIEW_API_BASE_URL`), whose
  CORS allows `PREVIEW_ORIGIN` (`apps/cdk/constants`); production's API keeps
  no CORS. CORS can't be scoped by path, so that is every page on
  `yusufaf.dev`, not only previews. It's acceptable because the API takes
  bearer tokens, not cookies, and nothing on that origin holds a dev token
- is `noindex` on every route and drops Umami (`vite.config.ts`, which fails
  the build if it can't find the Umami script)
- turns sign-in off: the router sends `/login`, `/sign-up`, `/callback` and
  every `requiresAuth` route to a `sign-in-off` page. Keep it that way: a
  preview shares the `yusufaf.dev` origin, and its storage, with the user site
  and other project pages, and its `/callback` isn't a registered Logto
  redirect URI

The `gh-pages` root holds only `.nojekyll` and an `index.html` that redirects
to nba.yusufaf.dev. The apex site (yusufaf.github.io) must never add a
`/nba-central` route, or it shadows the previews.

## Release process

Each package releases independently via
[release-please](https://github.com/googleapis/release-please) — `web` and
`cdk` are separate components in `release-please-config.json`, each with its
own manifest entry and its own PR. Tags: `web-vX.Y.Z`, `cdk-vX.Y.Z`.

### Milestones

- One GitHub milestone per package release, named to match the tag: `web v0.1.1`, `cdk v0.1.1`.
- Milestones = "which release". Labels (`bug`, `enhancement`, `area:web`, `area:cdk`, ...) = "what kind" and "which package". A Projects board, if one is ever added, is "workflow status" — don't use milestones as a kanban board.
- Only put an issue in a milestone once it's actually committed to that release — an untargeted issue (like a large audit-sized item) stays milestone-less until it's scoped down into something a release can carry.
- Close a milestone once its release is tagged.

### Issue hygiene

- Merged PRs often reference an issue number in the title/commit (e.g. `(#32)`) without an actual `Closes #32` — this does **not** auto-close the issue. Check `gh issue view <n> --json state,closedAt` or the issue's linked PRs before assuming an issue tracks *unshipped* work.

## Development Guidelines

### General
- Use **pnpm** instead of npm for all package management commands, run from the repo root with `--filter <web|cdk>` to scope to one package

### Frontend (apps/web)

**CSS & Styling:**
- **ALWAYS use `rem` units instead of `px`** for all spacing, sizing, and layout values
  - Example: Use `1.5rem` instead of `24px`
  - Conversion: 16px = 1rem (browser default)
  - Rationale: `rem` units scale with user font size preferences for better accessibility
- Use Tailwind utility classes where possible
- For custom CSS, prefer scoped styles in component `<style scoped>` blocks
- Use CSS custom properties (variables) for theming via HSL color system
