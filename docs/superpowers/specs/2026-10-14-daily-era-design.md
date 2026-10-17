# Daily Era: design decisions

**Date:** 2026-10-14 (revised 2026-10-15 after review)
**Status:** approved design, not yet implemented
**Issue:** #172 (build slices #173, #174, #175, #176, #177; milestone "Daily Era")

## Why

"Which Era?" is a daily game: a historical jersey is shown and the player
guesses when it was worn. Existing NBA dailies guess players, and nobody does
eras. The data is already in the repo (`historicalJerseys.json`, built by
`refresh-historical-jerseys`), so there is nothing to write by hand, and the
answer reveal can link back into the builder. This spec settles what every
build slice depends on: the puzzle pool, how a guess is scored, how the
answer stays secret, the image treatment, the day boundary and order, and
streaks.

## What the data looks like

Measured on `origin/main` on 2026-10-14 and 2026-10-15. The image figures
come from downloading and classifying all 792 pool images.

**Rows**

- `historicalJerseys.json` has 1,236 rows. 805 are `slot: "home-road"`. Of
  those, 792 have a `franchise`, covering 44 franchises. The other 13 are
  defunct teams such as the Detroit Falcons.
- By the `league` tag, 749 are NBA and 43 are ABA. Another 22 ABA-era designs
  (Nets, Spurs, Pacers, Nuggets) are tagged NBA.

**Season convention**

- Every year field uses the **season's ending year**: `startYear: 1996` means
  1995-96.
- `seasons` lists the seasons a design was actually worn, as strings like
  `"1995-96"`.

**Runs**

- A run (`endYear - startYear + 1`) has a median of 2 seasons, a 90th
  percentile of 5 and a maximum of 18. 379 designs lasted one season.
- **112 rows have gaps** in their `seasons` list. For example, the Vancouver
  Grizzlies row runs 1996–1999 but skips 1996-97, which belongs to a sibling
  variant row. So `startYear..endYear` is not the set of seasons a design was
  worn.
- **Some rows are the same jersey.** 116 rows have a near-identical twin
  from the same franchise with a different run (fewer than 0.1% of
  jersey-area pixels differ). 46 names appear on more than one row.
- **32 rows are still being worn**, with "Present" in the name. Only 4 of
  them have `endYear` 2026. The other 28 stop at 2023–2025, and all 32 will
  keep going after the data was built.

**Images**

- All 792 images are 400×400 illustrations by the Basketball Jersey Database
  (bballjerseys.com).
- 782 use one template:
  - the home and road jerseys side by side, split at x≈200;
  - a year label above **each** jersey, for the pair's run (for example
    "1995/2000");
  - a `bballjerseys.com` watermark at the top centre;
  - on about 18% of images, a caption line near y≈372 that names an occasion
    such as "NBA 50th Anniversary" or "911 Commemorative Patches", which
    gives the era away;
  - an `@nba.jersey.database` handle at the bottom.
- The year label sits at one of three heights depending on the era: y≈48
  (mostly 1940s–80s), y≈32 (mid-90s) and y≈22 (2000s on). The jerseys start
  just below it.
- The home and road jerseys **often have different printed runs**, because a
  row's run covers the pair. For example, a Celtics row reads 1954/1967 above
  the home jersey and 1965/1967 above the road.
- 10 OKC/BOS images from 2014 on use a second template: a white frame, the
  team name in a top bar, vertical watermarks, and "ICON"/"ASSOCIATION"
  printed at the bottom.

**URLs**

- Image URLs are already opaque (`jerseys/historical/31d308_<hash>.avif`).
  But the builder imports `historicalJerseys.json` eagerly, so every page load
  ships a map from each URL to its years. Showing a bundled URL in the game
  would give the answer away.

## Decisions

1. **Jerseys only at launch.** The pool is the home-road rows with a
   `franchise`, with the exclusions in decision 7 and the grouping in
   decision 2.
   - Logos are left out: most spell out the team name, and their file names
     contain the team and year (`TRI-1950.<hash>.png`).
   - They can come back later as a variant once the jersey format is proven.

2. **Players guess the era, and the team stays visible.** Every jersey has
   its wordmark on the chest, so the challenge is "which Spurs era is this".
   There is no team guess. #175 does not use the team combobox.

   The **answer set** for a puzzle is the set of seasons, by ending year, in
   which the jersey shown was worn:
   - Rows that show the same jersey are grouped. A group is rows of the same
     franchise whose cropped jersey images are near-identical (the threshold
     is set by the script and checked on its contact sheet).
   - Each group becomes one puzzle. Its answer set is the union of the
     `seasons` lists of every row in the group, falling back to
     `startYear..endYear` for a row whose `seasons` list is empty.
   - The puzzle shows the group's earliest row. Every row in a published
     group passed validation (decision 5, step 5).

3. **A guess is a season, with four attempts and hints.**
   - **The picker** shows season labels ("1995-96") from 1946-47 to the
     current season, which is 81 seasons in 2026-27. It submits the ending
     year.
   - **A hit** is a guess that is in the answer set.
   - **A miss** returns a **direction**, which is `later` if the nearest
     answer season is after the guess and `earlier` if it is before.
   - **A miss** also returns a **band** for the distance to the nearest
     answer season: `close` within 3 seasons, `near` within 10, and `far`
     beyond that.
   - **The game ends** on a hit or after the fourth guess.
   - **Skill shows in guesses used, not in winning.** The team is visible,
     so a player's real search space is that team's lifetime, and often only
     the era its wordmark names (the "Vancouver Grizzlies" were six
     seasons). With a direction and three bands, a fixed search that knows
     nothing about jerseys can find a one-season answer in up to 47
     contiguous seasons in four guesses, and a multi-season answer is
     easier still. That covers most teams. No hint scheme fixes this for
     short-lived teams, so the game doesn't try to make winning hard. A
     player who knows jerseys wins in 1 or 2, a searcher in 3 or 4, and the
     share row shows which. Four guesses rather than five keep a careless
     search from always winning.

4. **The share row shows the path, not the answer.**
   - Each guess becomes one emoji: 🟩 for a hit, and 🟨, 🟧 or ⬛ for a
     `close`, `near` or `far` miss.
   - A miss is followed by ⬆️ for `later` or ⬇️ for `earlier`.
   - The text includes the day number, guesses used, the current streak and
     the site link, for example
     `Which Era? #12 3/4 🔥5 ⬛⬆️ 🟨⬇️ 🟩 nba.yusufaf.dev/daily`.
   - It never includes the seasons or the franchise (#176).

5. **The game uses its own images, built offline under random keys.** A new
   script, `refresh-daily-era` in `apps/cdk`, is run deliberately like the
   other `refresh-*` scripts. For each pool row it:
   1. downloads the source image;
   2. **detects the template.** The OKC/BOS frame template is excluded, along
      with anything else that doesn't match the standard layout;
   3. **crops per image.** It finds the first jersey row below the year
      labels (the label height varies by era) and the last row of the
      shorts. Everything above and below is cut, which removes the labels,
      the watermark, the caption and the handle. **Both jerseys are kept**,
      so the answer set matches what is shown;
   4. **validates the crop.** Any image whose crop looks wrong (the crop
      height is out of range, or text pixels are left in the cut bands) is
      dropped;
   5. **groups identical jerseys** (decision 2), comparing the validated
      crops from step 3 before any random framing, so twins still match.
      A row dropped in step 2 or 4 can't be compared, so it might have been
      a twin. To stay safe, a group is **excluded** when a same-franchise
      row that was dropped, or whose name matches `/present/i`, has a season
      within 3 seasons of the group's answer set. Leaving a puzzle out is
      better than publishing one with an incomplete answer set;
   6. adds a small uneven margin and re-encodes the group's image as WebP at
      a different size, so its framing and bytes never match the original;
   7. uploads to the assets bucket under a **random** key
      (`daily-era/<random id>.webp`), so nothing links it to the bundled
      list. Only images that passed every step are uploaded;
   8. writes a contact sheet of every crop and group, so a person can review
      the batch before the list is published.

   No colour change, mirroring or warping is applied: colour is the main
   clue, and mirroring flips the wordmark and numbers. A determined player can
   still reverse-search an image. With no leaderboard, they only spoil their
   own game.

   Decoding AVIF and re-encoding needs an image library, which the scripts
   have avoided so far (`pngAlpha.ts` uses only `zlib`). The script may add one
   as a dev dependency of `apps/cdk`, used only by the script and never
   bundled into a Lambda. Check the package and version against the registry
   when implementing.

6. **The puzzle list is private and frozen.** The script writes
   `daily-era-puzzles.json` to the static-data bucket. It is never bundled
   into the web app.
   - **Entry fields:**
     - an opaque random `puzzleId`;
     - the image key;
     - the answer set;
     - the run label for the reveal;
     - the franchise and the era's team name;
     - the stable identity of every row in the group, plus `shownIdentity`
       for the row whose image is shown. An identity is the jersey's
       **Wix media id**, the `31d308_…` stem of its image URL, which is
       unique across all rows and survives a `refresh-historical-jerseys`
       re-run. `franchise`, `name` and `startYear` are stored alongside for
       people reading the list, but they are not the key: that triple is
       shared by 21 home-road rows today (10 triples, for example LAL
       1972-73 and NYK 1946-53), 4 of them visibly different designs. The
       script refuses to publish if a row's media id is missing or shared.
     - `jersey` URLs themselves are never stored: the stem is a stable
       upstream id, but the CDN domain and file extension can change. The
       client resolves `shownIdentity.mediaId` against the bundled
       `historicalJerseys.json` (`slot: "home-road"` only) at reveal time,
       for the full image and the builder link. If the row is gone, the
       reveal shows the daily crop and no builder link.
   - **Order:** the first batch is shuffled once with a fixed seed. Later
     runs append only groups none of whose identities is already in the
     list, shuffled among themselves, so a published day never moves or
     changes, and appended batches don't come in franchise order.
   - **A new row that is a twin of a published group** (for example a
     sibling variant added by a data refresh) is not appended. The script
     reports it. A day already played is never changed. A person may
     extend the answer set of an entry whose day hasn't come yet. Played
     days keep the stale answer set, which is a known limitation.
   - **Running out** (deferred: #174 ships only the first cycle, about 470
     puzzles or 15 months; the second cycle needs puzzle #1's launch date,
     which #173 sets): when fewer than 90 unplayed days remain, the script
     appends a reshuffled second cycle of the pool and warns. Each cycle-2
     entry gets a **new** `puzzleId`, so every id maps to exactly one day.
     The identity check that prevents duplicates applies within a cycle,
     not across cycles. The API returns 410 for a date past the end of the
     list, rather than throwing.
   - This replaces #173's "deterministic hash of the UTC date".

7. **Excluded from the pool:**
   - every group containing, or adjacent to, a row whose `name` matches
     `/present/i` (32 rows), because its answer set is still growing (see
     decision 5, step 5);
   - the 10 frame-template images;
   - any image that fails validation in decision 5.

   ABA designs stay in.

8. **A day starts at the player's local midnight, like Wordle.**
   - **Request:** the client asks for its local date:
     `GET /api/daily/era/2026-11-06`.
   - **Today's window:** the server accepts, as "today", any date from
     `date(now − 12h)` to `date(now + 14h)` in UTC, which is exactly the
     range of dates in effect somewhere on Earth.
   - **Archive:** the 30 dates before the **earliest** date in today's
     window are also accepted, so a player in the furthest-west time zone
     still gets their full 30 days. The client lists its own local
     date − 1 to date − 30, which always falls inside this range.
   - **The playable window** is today's window plus the archive. Anything
     else, including dates before puzzle #1, returns 410 (400 for a
     malformed date). Not 404: the distribution's SPA error pages turn any
     403 or 404, `/api/*` included, into a 200 `index.html` and cache it
     for 300 s.
   - **Puzzle #1 is 2026-10-05** (`DAILY_ERA_FIRST_DATE` in
     `apps/cdk/models/daily-era.ts`), 32 days before the 2026-11-06 go-live.
     It must never change once anyone has played.
   - **Launch:** puzzle #1 is dated 32 days **before** go-live (in UTC), so
     every time zone has a full 30-day archive on launch day (#177's goal). The puzzle number is days
     since puzzle #1's date plus 1, and the day's puzzle is the entry at that
     position.
   - **Caching:** today every `/api/*` request is uncached
     (`team-builder-web.ts` sets `CachePolicy.CACHING_DISABLED`).
     - #173 adds a CloudFront behavior for `/api/daily/era/*`, listed before
       `/api/*`, with a cache policy that honours the origin's
       `Cache-Control`.
     - Because the behavior also matches `POST /api/daily/era/guess`, it
       must copy `/api/*`'s `AllowedMethods.ALLOW_ALL` and its
       `ALL_VIEWER_EXCEPT_HOST_HEADER` origin request policy. Only the cache
       policy differs.
     - A successful GET sends a public `max-age` of at most 1 hour, and
       never longer than the time left before the date leaves the playable
       window. The puzzle for a date never changes, but whether it is still
       playable does.
     - If a guess is refused because the date has just left the window, the
       client shows "This puzzle is no longer playable" rather than an
       error.
     - A 4xx or 5xx sends `no-store`, so a refusal for a date that becomes
       valid later is never cached. Refusals are 400 or 410, never 403 or
       404, for the reason above.
     - POST is never cached.

9. **Guesses are checked on the server, which keeps no state.**
   - **Envelope:** both routes answer in the repo's `ApiResponse` shape,
     `{ success: true, data }` or `{ success: false, error }`. The fields
     listed below are exactly `data`'s keys.
   - **`GET /api/daily/era/{date}`** returns `{ puzzleNumber, puzzleId,
     imageUrl }` and nothing else.
   - **`POST /api/daily/era/guess`** takes `{ puzzleId, season, attempt }`.
     - The server looks up which day that `puzzleId` belongs to and refuses
       it if that day is outside the **playable window** in decision 8
       (today's window plus the archive). Archive puzzles can be played, and
       nothing past the window can be fetched. Serving every time zone means
       the window is up to a day ahead of some players' local date. Reading
       that day's answer early takes deliberate URL editing, and it
       spoils only a day that has already started somewhere else.
     - It returns `{ hit, direction, band }`, with `direction` and `band`
       `null` on a hit. A malformed body, an `attempt` outside 1-4 or a
       season outside 1947 to the current season returns 400; an unknown
       `puzzleId` or a day outside the window returns 410.
     - It adds the answer (run label, team name, franchise and
       `shownIdentity`) only when `hit` is true or `attempt` is 4. The
       server never builds the builder link; the client does (decision 6).
   - **No stored state.** A player could send `attempt: 4`, or every season,
     for a playable day and read off the answer. That spoils only their own
     game, because there is no leaderboard. Tracking guesses per player would
     need a table, an id cookie and rate limiting, which is too much here.
   - **Templates:** both routes are public and go in `PUBLIC_ROUTES`
     (`team-builder-api-routes.ts`). `getPublicTeam` is the template for a
     public route. `getPlayers` is the template for reading a JSON file from
     the static-data bucket, and the main Lambda role can already read that
     bucket.

10. **The reveal sends players into the site.**
    - After the game the page shows the run label, the team's name in that
      era, the original full image, and a link that opens the builder with
      that jersey selected. The client finds the image and link from
      `shownIdentity` at reveal time (decision 6).
    - It also shows a countdown to the next local midnight.
    - The builder reads only `team`, `remix` and `resume` from its query
      today. The link needs a new query parameter that preselects a
      historical jersey on a blank team. That work belongs to #175.

11. **The artwork is credited.** The crop removes the watermark and the
    handle. So the page shows "Jersey art: Basketball Jersey Database",
    linked to bballjerseys.com, under the image during the game and on the
    reveal. The share card (#176) carries the same credit in small text. It
    is worth asking the site owner directly whether they're happy with this
    use; that is the owner's call and doesn't block the build.

12. **No sign-in, and streaks are kept in local storage.** Following #177:
    - The current streak counts consecutive local days won. A loss or a
      missed day resets it to zero, as in Wordle.
    - Also stored: best streak, games played, win rate, the guess
      distribution, and **one result per date**.
    - Every storage read and write is wrapped in try/catch. If storage is
      blocked, the game is still playable without a streak.
    - Syncing streaks to an account is a later decision, because
      `SETTINGS_SCHEMA` only allows boolean and enum keys.

13. **The archive covers the last 30 days.**
    - Archive games count as played and appear in the distribution, but they
      never extend or break the current streak.
    - Opening a date that already has a stored result shows that result
      rather than a new game, so a lost day can't be replayed into a win and
      no day is counted twice.

## Changes to the build issues

| Issue | Change from the issue text |
|---|---|
| #173 | **Pool and lookup:** jerseys only. The day's puzzle is a position in the frozen list (decision 6), keyed by the player's local date (decision 8), not a UTC-date hash. **Guess route:** takes an opaque `puzzleId`, refuses days outside the playable window (today plus archive), and returns `hit`/`direction`/`band` with no team result. It reveals the answer on a hit or the 4th attempt. **Infra:** a new CloudFront behavior for `/api/daily/era/*` with `ALLOW_ALL` and `/api/*`'s origin request policy, a GET `max-age` of at most 1 hour, `no-store` on errors, and a 410 past the end of the list (400 for a malformed date; never 404, see decision 8). Read the list with the `getPlayers` pattern. |
| #174 | **Jerseys only.** The per-image crop, template detection, validate-before-upload, identical-jersey grouping, contact sheet and random keys from decision 5. **Both jerseys are kept.** Gallery assets are unchanged. |
| #175 | **Era-only:** a season picker, 4 attempts, and the hit/direction/band feedback from decision 3. **Reveal and credit:** the reveal and builder link from decision 10, including the new builder query parameter, and the art credit. The Umami events stay as written. |
| #176 | The share text from decision 4, with day number, guesses out of 4, streak and emoji path, and no team result. The card carries the art credit. |
| #177 | Streaks count consecutive local days won, with one stored result per date. Archive games never affect the streak and can't be replayed. Puzzle #1 is dated 32 days before launch, so every time zone has a full archive on day one. |

## Out of scope

- Logos as puzzles (decision 1 leaves the door open).
- Leaderboards, accounts, or syncing streaks to an account.
- Guessing the team.
- Stopping a determined cheater (decisions 5 and 9 accept this).
