# TeamBuilder — NBA 2K Ratings Scope

Overlay NBA 2K overall ratings (and per-game-year rating history) onto the existing
BBRef player pool, so Add Player and roster cards can show/sort by a 0–99 rating.

## Status (2026-07-26) — shipped to development

All four build steps are **implemented, deployed, and verified end-to-end**.

| Step | State |
|---|---|
| Frontend off balldontlie → `/api/data/get-players` | Done |
| `setPlayerRatingsData` Lambda + CDK wiring | Deployed, invoked, output verified |
| `getPlayers` / `getPlayerStats` ratings merge | Deployed, verified live |
| UI: rating badge, Rating sort, team rating, history chart | Verified in the running app |

`player-ratings.json` is live in `team-builder-development-static-data` — 305 KB,
`gameVersion: 2K27`, 1,314 of 5,416 BBRef players matched (664 `current`, 303 `all-time`,
347 `classic-peak`), exactly matching the pre-deploy dry run. Unmatched current players:
11, all genuinely absent from `players.json` (2025-26 rookies and two-way players — a
Basketball-Reference gap, not a matcher fault). Unmatched all-time: 1 (Jim Paxson Sr./Jr.,
identical names *and* heights — correctly dropped rather than guessed).

LeBron carries 18 releases of history (2K10 → 2K27), further back than the 2K16 floor
the source docs implied.

Verified live: accented search (`jokic` → Nikola Jokić 98, `doncic` → Luka Dončić 97),
rating sort (seven 99s, all `all-time`), the position filter (`position=PG&minRating=95`
returns actual point guards — it matched nothing at all before), unrated players still
returned in results, and the full UI path (rating badge on the card, `98 OVR` team
rating in the Starting Lineup header, rating-history chart in the stats dialog).

Three matcher defects were found and fixed during the dry run:
initials punctuation (`PJ Dozier` vs `P.J. Dozier`), curly vs straight apostrophes
(`O'Neal`, `De'Aaron`), and father/son pairs where height can't separate them
(Glen Rice, Ron Harper, Glenn Robinson) — now settled by a suffix-aware exact-name pass.

### Build blocker found and fixed: CDK could not synth at all

`npx cdk synth` was failing for every layer-using Lambda. Two causes, both fixed:

1. **esbuild was invisible to aws-cdk-lib under pnpm.** CDK resolves esbuild from its own
   package location to decide whether it can bundle locally; pnpm's strict `node_modules`
   hid it, so CDK silently fell back to Docker bundling — where pnpm's symlinked deps
   don't resolve either, and every Lambda died with `Could not resolve "<package>"`.
   Fixed with `team-builder-cdk/.npmrc` → `public-hoist-pattern[]=esbuild`. Bundling is
   now local, and much faster.
   - The reinstall needed `--no-frozen-lockfile`: `pnpm-lock.yaml` had **pre-existing**
     drift from package.json (jest/ts-jest removed, vitest added, never re-locked), so
     `team-builder-cdk/pnpm-lock.yaml` is updated as a side effect.
   - esbuild's postinstall is blocked by pnpm's build-script policy; it needs
     `pnpm rebuild esbuild` after a clean install, or a permanent
     `pnpm.onlyBuiltDependencies` entry.
2. **Layer-provided packages were being bundled.** `node-fetch`/`cheerio`/`jsdom` come
   from Lambda layers at runtime but weren't marked external. Added `layerModuleLookup`
   in `resources/lambda/index.ts` and wired it into `TeamBuilderLambda`'s bundling
   options, which now also re-states `@aws-sdk/*` (setting `externalModules` replaces
   CDK's default rather than extending it).

`cdk synth` now exits 0. `cdk diff` is clean: one new Lambda, its EventBridge rule and
invoke permission, plus code-only updates to the Lambdas whose bundles changed.

**Still outstanding, unrelated to this work:**

- `pnpm run lint` in nba-central dies on a missing
  `ajv/lib/refs/json-schema-draft-04.json`. Root cause is the repo-root `package.json`
  `pnpm.overrides` pinning `"ajv": "8.20.0"`; ESLint 10 needs ajv 6's draft-04 refs.
- `pnpm run build` in team-builder-cdk reports 6 pre-existing `tsc` errors in
  `deleteCustom*`, `setCoachesData`, and `setExecsData`. (These don't block synth or
  deploy — CDK bundles with esbuild, which doesn't type-check.)

### Two bugs caught during deployment

1. **`node-fetch` must stay bundled, not externalized.** The first attempt at fixing the
   Docker-bundling failure marked layer-provided packages `external`. That broke every
   scraper Lambda at runtime: node-fetch v3 is ESM-only, so requiring it from the layer
   fails with `ERR_REQUIRE_ESM`. Reverted — esbuild has to bundle it into the CommonJS
   output. The layers stay attached but the bundle is what's used. Noted in
   `TeamBuilderLambda.ts` so this isn't "fixed" again.
2. **Search ignored diacritics.** `players.json` stores `Nikola Jokić` and `Luka Dončić`;
   nobody types those. The rewritten `getPlayers` was still doing a plain lowercase
   `includes`, so `jokic` returned zero results. Now both sides are NFD-folded to ASCII
   before comparing, so accented and unaccented input both work.

## Context

`players.json` (5,416 BBRef players) has **no rating field**. The only `overallRating`
in the app today is on user-created custom players
(`team-builder-cdk/models/custom-entities.ts`, validated 0–99 in
`team-builder-cdk/utilities/custom-entities-validation.ts`). Real players have nothing to
sort or rank by — `AddPlayerDialog.vue` sorts only Alphabetic / Team Name, and
`PlayerSlot.vue` shows PTS/REB/AST from the most recent season only.

2K ratings give every real player a single comparable number on the same 0–99 scale the
custom-player form already uses, which makes real and custom players directly comparable
in one roster.

## Data source

**Primary: `nba2kapi.com`** — free REST API over scraped 2kratings.com data.

- Base: `https://api.nba2kapi.com/api/`
- Code: [woverfield/nba2kapi](https://github.com/woverfield/nba2kapi), MIT.
- `GET /api/stats` (no auth) — current census:
  ```json
  { "totalPlayers": 1892, "uniqueTeams": 127, "avgOverall": 80,
    "byType": { "curr": 675, "class": 767, "allt": 450 },
    "lastUpdated": "2026-07-20T18:10:43.863Z" }
  ```
- `GET /api/public/players?teamType=&limit=&cursor=` — **unauthenticated**, 60 req/min per
  IP, `limit` max 100. 1,892 players ≈ 19 pages.
- `GET /api/players/bulk` — whole dataset in one call, but **401 without an API key**.
  Free key signup at nba2kapi.com; authed limit is 100 req/hour.
- Data is `gameVersion: "2K27"` as of 2026-07-20; scraper reruns weekly.

**Why not scrape 2kratings.com directly:** it returns **HTTP 403** to non-browser clients
(bot protection). Same class of problem as stats.nba.com being blocked from Lambda. The
API is a maintained, already-parsed proxy — use it and mirror the result.

**Rejected alternatives**
- HoopsHype `/nba-2k/players/` — current game only, no rating history archive on the list page.
- Kaggle "NBA 2K Ratings with Real NBA Stats" — static, stops at 2K21, no refresh.
- `MikeYan01/nba2k-player-ratings`, `kennypanjaitan/NBA2K24-data-scraper` — scrapers with no
  committed dump; would inherit the 403 problem.

### Relevant fields (`curr` player, verbatim from the API)

```jsonc
{
  "name": "Nikola Jokic",
  "slug": "nikola-jokic",
  "team": "Denver Nuggets",
  "teamType": "curr",              // curr | class | allt
  "overall": 98,
  "positions": ["C"],              // already PG/SG/SF/PF/C — matches our enum
  "height": "6'11\"", "weight": "284 lbs", "wingspan": "7'3\"",
  "gameVersion": "2K27",
  "playerUrl": "https://www.2kratings.com/nikola-jokic",
  "ratingHistory": [
    { "gameVersion": "2K27", "overall": 98, "delta": 0 },
    { "gameVersion": "2K26", "overall": 98, "delta": 1 },
    // ... down to 2K16
  ],
  "attributes": { /* 35 keys — NOT ingested, see Depth */ },
  "badges": { "list": [ /* ~24 entries w/ descriptions + images */ ] }
}
```

`class` entries are **season-scoped** and encode the season in `team`/`slug`:
`{"name":"Michael Jordan","slug":"michael-jordan-1992-93-chicago-bulls","team":"1992-93 Chicago Bulls","overall":99,"teamType":"class","ratingHistory":[]}`.
`allt` entries are career-peak: `{"name":"Michael Jordan","team":"All-Time Chicago Bulls","overall":99}`.

## Decisions

1. **Overlay, not replacement.** BBRef `players.json` stays the source of truth. Ratings are
   an optional field; unmatched players simply have none. (Chosen over adopting the 2K pool,
   which would drop ~3,500 BBRef-only players.)
2. **Depth: `overall` + `ratingHistory` only.** No attributes, no badges, no 2K images.
   Keeps the payload ~200 KB instead of ~10 MB, and avoids republishing 2K's badge art and
   copy. Attributes are a later, additive step if radar charts are ever wanted.
3. **History semantics — both, layered.** `ratingHistory` (2K16→2K27) is the headline
   feature and overlays cleanly onto the existing one-record-per-person model.
   `class`/`allt` entries are used **only as a rating fallback for retired players** (see
   below), not as new selectable players. Season-scoped legends as first-class roster
   entries are explicitly out of scope — the data model has no season concept
   (`PLAYERSTATS` SK is the bare player id) and adding one is its own project.

### Coverage and the retired-player problem

`curr` (675) only covers active players. Straight overlay would leave every retired player
unrated — including Jordan and Bird, which reads as broken. Fallback chain per BBRef player:

1. Match a `curr` entry → `rating`, `ratingSource: "current"`, full `ratingHistory`.
2. Else match an `allt` entry → `rating`, `ratingSource: "all-time"`, no history.
3. Else match `class` entries → take the **max** `overall` across that player's season
   versions → `rating`, `ratingSource: "classic-peak"`, and keep the season list.
4. Else no rating.

Realistic coverage: ~1,000–1,100 of 5,416 BBRef players (~20%), but that ~20% is every
player a user actually searches for. The UI must treat "no rating" as normal, not an error.

### Name matching (the main engineering risk)

There is **no shared id** between BBRef (`jamesle01`) and 2K (`lebron-james`). Join on
normalized name:

- Strip diacritics (`Jokić` → `Jokic`, `Dončić` → `Doncic`) — BBRef carries accents, 2K does not.
- Lowercase, strip `.`/`'`/`-`, collapse whitespace, strip suffixes (`Jr.`, `Sr.`, `II`, `III`).
- Collisions are real (multiple `Mike Dunleavy`, `Gary Payton`, `Glenn Robinson`,
  `Larry Nance`). Disambiguate with height (2K `"6'11\""` → feet/inches vs BBRef
  `height_feet`/`height_inches`, tolerance ±1 inch) and `active` (a `curr` 2K entry must
  match an `active: true` BBRef player).
- Log every unmatched 2K `curr` player — a `curr` player failing to match is a bug, since
  every active NBA player is in BBRef. Target: 0 unmatched `curr`.

## Backend changes

### New: `team-builder-cdk/service/lambdas/setPlayerRatingsData/`

Follows the existing `setPlayersData` / `setCoachesData` pattern exactly (EventBridge →
scrape → single JSON to the static-data bucket).

1. Page `GET /api/public/players?limit=100&cursor=` until `meta.pagination.hasMore === false`,
   for each `teamType` (`curr`, `class`, `allt`). ~19 requests. Pace at ~1.1 s
   (`REQUEST_DELAY_MS`, same idiom as `setPlayersData.ts:11`) to stay under 60 req/min —
   note this is **much** lighter than the BBRef scrapers' 2800 ms.
   - If a free API key is obtained, collapse to one `GET /api/players/bulk` call and read
     the key from an env var. Optional optimization; the public path works without it.
2. Read the current `players.json` from the static-data bucket (the `getPlayers.ts:24-32`
   `GetObjectCommand` + `transformToString` idiom).
3. Build the normalized-name index, apply the fallback chain, emit `player-ratings.json`:
   ```jsonc
   {
     "gameVersion": "2K27",
     "generated": "2026-07-26T...Z",
     "unmatchedCurrent": [],            // must be empty; for monitoring
     "data": {
       "jamesle01": {
         "rating": 90,
         "ratingSource": "current",
         "slug": "lebron-james",
         "history": [ { "gameVersion": "2K27", "overall": 90 }, ... ]
       },
       "jordami01": { "rating": 99, "ratingSource": "all-time", "slug": "michael-jordan" }
     }
   }
   ```
   Keyed by **BBRef id** so it joins to `players.json` with no further matching at read time.
4. Wire into `team-builder-api.ts` alongside the other setters (~line 152-157), schedule
   `Schedule.rate(Duration.days(7))` (source refreshes weekly), memory 1024 MB,
   timeout 5 min. Reuses the existing `main-lambda-role` S3 RW on the static-data bucket —
   no new IAM.
5. New constant in `team-builder-cdk/constants/index.ts`:
   `NBA2K_API_BASE_URL = "https://api.nba2kapi.com/api"`, next to `BBREF_BASE_URL`.

**Do not merge ratings into `players.json`.** Keeping a separate file means the rating
refresh cadence is independent of the BBRef scrape, and a bad ratings run can't corrupt the
player pool.

### `getPlayers/src/getPlayers.ts`

Currently reads `players.json`, substring-filters, returns everything unpaginated.

1. Also `GetObject` `player-ratings.json` (parallel `Promise.all`); tolerate 404 → no ratings.
2. Merge `rating` / `ratingSource` onto each player by `id`. Ship `history` only from the
   single-player path, not the list — it's ~12 entries × 1,000 players of dead weight in a
   list response.
3. Add `sort=rating` support (rating desc, unrated last) and a `minRating` filter, so the
   sort happens server-side over the full pool rather than over one page.
4. Add `limit`/`cursor`. This endpoint currently returns all ~5,416 records for an empty
   search — adding ratings makes that worse. Cap the default response.

Fix while here: `NormalizedPlayer.id` is `number` at `getPlayers.ts:9` but the writer emits
`string` (`setPlayersData.ts:17`). The rating join is keyed on that id, so the mismatch must
be resolved to `string`.

### Blocker: `getPlayers` is dead code

`getPlayers` and `getPlayerStats` are deployed but **nothing in the frontend calls them** —
`network/api.ts:91-96` `dataApi` exposes only `getTeamLogos`, and `AddPlayerDialog.vue:140-169`
still hits `https://www.balldontlie.io/api/v1` directly (`constants.ts:130`), a defunct
endpoint that now requires auth. Ratings cannot reach the UI until the frontend is switched
over to `/api/data/get-players`. **This migration is a prerequisite, not a nice-to-have**, and
is the larger half of the work.

## Frontend changes

1. `network/api.ts` — add `dataApi.getPlayers({ search, sort, limit, cursor })` and
   `dataApi.getPlayerStats(playerId)` wrappers next to `getTeamLogos`.
2. `AddPlayerDialog.vue:140-169` — replace the BDL axios call and its
   paginate-until-`next_page`-null loop with `dataApi.getPlayers`. Keep the 600 ms
   `useDebounceFn`. Delete `BDL_API_PREFIX` usage.
   - Note: this also fixes the position filter, which can never match today — scraped
     players carry BBRef positions (`F`, `G`, `F-C`) while the filter offers PG/SG/SF/PF/C
     (`AddPlayerDialog.vue:120-122`). 2K `positions` is already in the PG/SG/SF/PF/C
     vocabulary, so the ratings file can double as a position-normalization source.
3. `models/types.ts:64-87` — add to `Player`:
   `rating?: number`, `ratingSource?: 'current' | 'all-time' | 'classic-peak'`,
   `ratingHistory?: { gameVersion: string; overall: number }[]`.
   The custom-player `overallRating` field stays as-is; the UI reads
   `player.rating ?? player.overallRating` so custom and real players render identically.
4. `PlayerSlot.vue` — rating badge on the card front near `team.abbreviation` (line 124).
   Color-band it (99–90 / 89–80 / 79–70 / below) using the existing HSL CSS custom
   properties. All spacing in `rem` per project CSS rules.
5. `AddPlayerDialog.vue` — add `Rating` to the sort `Select` (line 67, currently
   `['Alphabetic','Team Name']`), and show the rating in each result row.
6. Roster team rating — average of the 5 starters' ratings in `RosterSection.vue`
   (starters are slots 1-5, `RosterSection.vue:34-35`). Cheap, and it's the payoff that
   makes ratings feel like a feature rather than a decoration.
7. `PlayerStatsDialog.vue` — a "2K rating history" line/sparkline from `ratingHistory`
   (2K16→2K27). Per the `dataviz` conventions if a real chart is used.

## Risks

- **Single hobbyist dependency.** nba2kapi could disappear. Mitigated by mirroring to our own
  S3 on a schedule — an outage degrades to stale ratings, never a broken app. The 403 on
  2kratings.com means there is no quick in-house fallback, so the mirror is load-bearing.
- **Legal.** 2K ratings are Take-Two/2K Sports content; nba2kapi states it is "not affiliated
  with 2K Sports or the NBA." Ingesting the numeric ratings for a non-commercial fan app is
  the same posture as the existing BBRef scraping. Deliberately **not** ingesting badge
  artwork, badge descriptions, or 2K player photos, which are the clearly copyrightable parts.
  Attribute the source in the UI.
- **Annual game rollover.** Every autumn 2K ships a new game; `gameVersion` flips and all
  ratings change. The weekly schedule handles it automatically, but the UI should show which
  game version it is displaying rather than an undated "Rating".
- **Coverage optics.** ~80% of the pool will show no rating. Design the empty state
  deliberately ("Not rated in 2K27"), don't render a `0` or `—` that reads as a score.
- **Name-match false positives** are worse than misses — a wrong join puts Michael Jordan's
  99 on the wrong player. Require the height check on any name that matches more than one
  BBRef player, and drop ambiguous matches rather than guessing.

## Effort estimate

- Prerequisite (frontend BDL → `getPlayers` migration): ~1 day.
- `setPlayerRatingsData` Lambda + name matcher + CDK wiring: ~1 day.
- `getPlayers` merge/sort/pagination: ~0.5 day.
- Frontend rating badge, sort, team rating, history chart: ~1 day.

**~3.5 days**, of which ~1 day is paying off the existing BDL dead-endpoint debt.

## Build order

1. Frontend migrates off balldontlie to `/api/data/get-players` — verify Add Player still
   works with zero ratings involved.
2. `setPlayerRatingsData` Lambda; deploy; invoke once; inspect `player-ratings.json` in the
   static-data bucket. Verify `unmatchedCurrent` is empty; spot-check LeBron (`jamesle01`,
   `curr`), Jordan (`jordami01`, `all-time` fallback), an accented name (`Jokić`,
   `Dončić`), and a collision (`Mike Dunleavy` Sr. vs Jr.).
3. `getPlayers` merge + `sort=rating` + pagination.
4. Frontend: `rating` on `Player`, badge on `PlayerSlot`, Rating sort, starter-average team
   rating, `ratingHistory` chart.
5. Verify end-to-end in the running app.

## Verification

```bash
# Source is alive and current
curl -s https://api.nba2kapi.com/api/stats

# After deploy — ratings file landed
aws s3 cp s3://team-builder-development-static-data/player-ratings.json - | head -c 2000

# Merge works end-to-end
curl -s 'http://127.0.0.1:8000/api/data/get-players?search=lebron'
curl -s 'http://127.0.0.1:8000/api/data/get-players?sort=rating&limit=10'
```

Then `cd nba-central && pnpm run start`, open Team Builder, add LeBron and Jordan to the
starting five, and confirm both show a rating, the Rating sort orders correctly, unrated
players sink to the bottom, and the team rating updates.
