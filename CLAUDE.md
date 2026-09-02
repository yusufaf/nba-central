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

pnpm --filter cdk build         # tsc
pnpm --filter cdk test          # vitest
pnpm --filter cdk lint          # ESLint
pnpm --filter cdk exec cdk synth   # generate CloudFormation
pnpm --filter cdk exec cdk diff    # compare with deployed
pnpm --filter cdk exec cdk deploy  # deploy to AWS

pnpm --filter cdk refresh-arenas            # rewrite apps/web's arenas.json from Wikipedia
pnpm --filter cdk refresh-coaches           # rewrite coaches.json from Basketball-Reference
pnpm --filter cdk refresh-execs             # rewrite execs.json from Basketball-Reference
pnpm --filter cdk refresh-historical-logos  # rewrite historicalLogos.json + public/logos/historical/
pnpm --filter cdk run refresh-<name> -- --check  # validate against the live source, write nothing

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

Entry point: `bin/team-builder-cdk.ts` loads env vars from dotenv.

### Lambda Functions — `apps/cdk/service/lambdas/*/src/`

**API Lambdas** (HTTP endpoints):
- `apiAuthorizer`: JWT verification for all API requests
- Teams CRUD: `createTeam`, `getTeam`, `listTeams`, `updateTeam`, `deleteTeam`
- Custom entities CRUD (GM/Coach/Player, each create/list/update/delete): `createCustomGM`/`createCustomCoach`/`createCustomPlayer`, and their `list*`/`update*`/`delete*` counterparts
- `saveUserData`
- S3 multipart upload flow: `initiateMultipartUpload`, `getMultipartSignedUploadUrls`, `completeMultipartUpload`, `deleteFile`
- `getTeamLogos`: fetch ESPN API for NBA team logos
- `getPlayers`, `getPlayerStats`: player data + 2K ratings, merged from `players.json` and `player-ratings.json`
- `getNews`: reads news articles fetched by `fetchNewsCron`
- `sendFeedback`: email via SES

**Data ETL Lambdas** (EventBridge triggers):
- `setArenasData`, `setCoachesData`, `setExecsData`: scrape Wikipedia / Basketball-Reference
- `setPlayersData`, `setPlayerRatingsData`: scrape Basketball-Reference / api.nba2kapi.com
- `fetchNewsCron`: pulls ESPN, Bluesky, CBS Sports, and RealGM into the news table

`setArenasData`/`setCoachesData`/`setExecsData` write a bare array to the
static-data bucket matching the shape the frontend imports from
`src/assets/data/`. Their parsers are exported (`parseArenas`, `parseCoaches`,
`parseExecs`) and reused by the `refresh-*` scripts and tests. There is no
Lambda for historical logos — see Frontend below.

Lambda layers: `node-fetch_cheerio`, `node-fetch_jsdom` for web scraping.

### Frontend (Vue 3) — `apps/web`

Stack: Vite + Vue Router + Pinia + Tailwind v4 + reka-ui/shadcn-vue + Axios

There is **no Quasar** — it was removed after `6ff4e75`, and no dependency,
config or `<q-*>` component remains.

For anything touching the UI, read `apps/web/CLAUDE.md` and
`apps/web/DESIGN.md` first. They carry the design tokens, the layout rules,
and the constraints enforced by `pnpm --filter web check:styles`.

**Key Directories** (all under `apps/web/`):
- `src/views/`: Page components (Home, TeamBuilder, Scores, News, Teams, Login, SignUp)
- `src/layouts/`: `PageShell` — the single page container (width + gutters)
- `src/components/ui/`: vendored shadcn-vue wrappers over reka-ui primitives
- `src/components/TeamBuilder/`: Feature components (CoachSection, ArenaSection, etc.)
- `src/network/api.ts`: Axios client with API methods (fileApi, userApi, teamApi, dataApi)
- `src/stores/`: Pinia stores (teams.ts)
- `src/models/`: TypeScript types (types.ts, api.ts)
- `src/assets/data/`: Static JSON (coaches, arenas, execs, countries, historicalLogos)

These files are imported directly, not fetched — they are small and change rarely,
so a request would cost more than it saves. Players moved to an API (`getPlayers`)
because that dataset is large and needs search/filter. `arenas.json`, `coaches.json`,
`execs.json` and `historicalLogos.json` are all regenerated by their `refresh-*`
scripts in `apps/cdk`. The first three reuse the same parsers as
`setArenasData` / `setCoachesData` / `setExecsData`, so the S3 copies and the
checked-in files share one schema; `historicalLogos.json` has no Lambda
counterpart — its parsers live in `apps/cdk/scripts/lib/` instead. Regenerating
is a deliberate, reviewable step — do not hand-edit them.

`historicalLogos.json` is generated by `pnpm --filter cdk refresh-historical-logos`,
which crawls every NBA/BAA/ABA franchise Basketball-Reference tracks and hashes
each season's logo image to collapse ~1,700 team-seasons into a few hundred
distinct logo eras. The PNGs themselves live in `apps/web/public/logos/historical/`,
referenced by plain URL rather than imported, so ~230 images stay out of Vite's
import graph. There is no Lambda for this dataset — it changes roughly once a
decade per franchise, and 1,700+ requests don't fit a Lambda timeout — so it is
script-only, unlike the other three.

Basketball-Reference serves those logos as 125×125 palette PNGs with an opaque
white background, which reads as a white square on the dark theme. The refresh
script keys that background out as it downloads (`apps/cdk/scripts/lib/pngAlpha.ts`:
flood-fill inward from the border so white *inside* the artwork survives, then
remap to a `tRNS` palette entry — node's builtin `zlib`, no image library).
`pnpm --filter cdk rekey-historical-logos` applies the same transform to the
already checked-in PNGs without re-crawling, and is idempotent.

**Dev Server**: Vite proxy forwards `/api` to `http://127.0.0.1:8000` (must use 127.0.0.1, not localhost).

**Path Alias**: `@` → `src/`

### Authentication Flow

Auth is [Logto](https://logto.io) (self-hosted OIDC, `logto-af.fly.dev`) — a
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

A handful of read-only routes (`/api/data/*`, `/api/news/get`) skip the
authorizer entirely — `App.vue` calls them on every page load, signed in or
not.

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
- **assets**: Static assets
- **static-data**: External data cache (arenas, coaches, execs)

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
