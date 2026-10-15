# Daily Era: design decisions

**Date:** 2026-10-14
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

Measured on `origin/main` on 2026-10-14:

- `historicalJerseys.json` has 1,236 rows. Of these, 792 are `slot:
  "home-road"` with a `franchise`, covering 44 franchises (749 NBA, 43 ABA).
- A design's run (`endYear - startYear + 1`) has a median of 2 seasons, a
  90th percentile of 5, and a maximum of 18. 379 designs lasted one season.
  Start years run from 1947 to 2025. Every decade has between 22 and 154
  designs, and the 1970s have the most.
- Each jersey image is an illustration by the Basketball Jersey Database
  (bballjerseys.com). It shows the home and road jerseys side by side, the
  team wordmark on the chest, the years printed above the jerseys (for
  example "1995/2000"), a `bballjerseys.com` watermark at the top and an
  `@nba.jersey.database` handle at the bottom.
- The image URLs are already opaque
  (`jerseys/historical/31d308_<hash>.avif`), but the builder bundles
  `historicalJerseys.json` into every page load, and it maps each URL to its
  years. Showing a bundled URL in the game would give the answer away.

## Decisions

1. **Jerseys only at launch.** The pool is the `home-road` rows with a
   `franchise`. That is about two years of daily puzzles without repeats.
   Logos are left out: most of them spell out the team name, and their file
   names contain the team and year (`TRI-1950.<hash>.png`). They can come
   back later as a variant (for example a weekly logo day) once the jersey
   format is proven.

2. **Players guess the era only, and the team stays visible.** Every jersey
   has its wordmark on the chest, in a different place and style each time,
   so hiding it would mean hand-masking each image or detecting text
   automatically, which fails on script fonts. The challenge is "which Spurs
   era is this", which matches the game's name. There is no team guess, so
   #175 does not use the team combobox.

3. **A guess is a season, with five attempts and hints.**
   - The input is a season picker from 1946-47 to the current season.
   - A guess is a **hit** if the season falls anywhere in the design's run
     (`startYear` to `endYear`, inclusive).
   - A miss returns a **direction** (`earlier` or `later`) and a **band** for
     the distance to the nearest end of the run: `close` within 3 seasons,
     `near` within 10, and `far` beyond that.
   - The game ends on a hit or after the fifth guess.
   - Five guesses is fewer than a blind binary search needs to pin down a
     one-season design over 80 seasons (about 7), so knowing jerseys matters
     more than search strategy, and the bands still help a near miss.

4. **The share row shows the path, not the answer.** Each guess becomes one
   emoji: 🟩 for a hit; 🟨, 🟧 or ⬛ for a `close`, `near` or `far` miss,
   followed by ⬆️ or ⬇️ for the direction. Example:
   `Which Era? #12 4/5 ⬛⬆️ 🟧⬇️ 🟨⬆️ 🟩`. It includes the day number and
   the site link and never includes the seasons or the franchise (#176).

5. **The game uses its own images, built offline under random keys.** A new
   script, `refresh-daily-era` in `apps/cdk`, is run deliberately like the
   other `refresh-*` scripts. For each jersey in the pool it:
   - downloads the source image;
   - crops off the top band (the years and the watermark);
   - keeps **one** of the two jerseys, home or road, chosen when the list is
     built and kept fixed;
   - adds a small uneven margin and re-encodes it at a different size, so the
     framing and bytes never match the original;
   - uploads it to the assets bucket under a **random** key
     (`daily-era/<random id>.webp`), not a hash of the source, so nothing
     links it to the bundled list;
   - checks that the image matches the expected template (dimensions and
     where the band sits) and drops any jersey that doesn't, rather than
     guessing at the crop.

   No colour change, mirroring or warping is applied: colour is the main
   clue, and mirroring flips the wordmark and numbers. A determined player
   can still reverse-search an image. With no leaderboard, they only spoil
   their own game, so lighter changes are enough to stop casual lookups
   without hurting honest players.

   Decoding AVIF and re-encoding needs an image library, which the scripts
   have avoided so far (`pngAlpha.ts` uses only `zlib`). The script may add
   one as a dev dependency of `apps/cdk`, used only by the script and never
   bundled into a Lambda. Check the package and version against the
   registry when implementing.

6. **The puzzle list is private and frozen.** The script writes
   `daily-era-puzzles.json` to the static-data bucket. It is never bundled
   into the web app. Each entry has a puzzle id, the image key, `startYear`,
   `endYear`, the franchise and the era's team name (for the reveal), and
   the source `jersey` URL (for the builder link). The order is shuffled
   once with a fixed seed and stored. Re-running the script appends new
   jerseys at the end and never reorders or edits published days, so a
   refresh of the jersey data can't change an old puzzle. This replaces
   #173's "deterministic hash of the UTC date".

7. **Excluded from the pool:** the four open-ended designs ("2019–Present"),
   whose `endYear` moves each season, and any jersey whose crop failed the
   template check. ABA designs stay in.

8. **A day starts at the player's local midnight, like Wordle.**
   - The client asks for its local date: `GET /api/daily/era/2026-11-06`.
   - The server accepts any date between yesterday and tomorrow in UTC terms,
     which covers every time zone, plus dates in the 30-day archive. It
     refuses later dates and dates before launch.
   - Puzzle number = days since launch + 1, and the day's puzzle is the entry
     at that position in the frozen list.
   - Because the date is part of the URL, CloudFront can cache each day's
     response with no special handling at the day boundary.

9. **Guesses are checked on the server, and the server keeps no state.**
   - `GET /api/daily/era/{date}` returns `{ puzzleNumber, puzzleId,
     imageUrl }` and nothing else.
   - `POST /api/daily/era/guess` takes `{ puzzleId, season, attempt }`. It
     returns `{ hit, direction, band }`, plus the answer (run, team name,
     franchise, builder link) only when `hit` is true or `attempt` is 5.
   - The server stores nothing. A player could send all 80 seasons to the
     API and read off the answer, but they would only spoil their own streak.
     Tracking guesses per player would mean a table, an id cookie and rate
     limiting, which is too much for a game with no leaderboard.
   - Both routes are public (no authorizer) and go in `PUBLIC_ROUTES`, using
     `getPublicTeam` as the template.

10. **The reveal sends players into the site.** After the game the page shows
    the season run, the team's name in that era, the full original image, and
    a link that opens the builder with that jersey selected. It also shows a
    countdown to the next local midnight. The builder reads only `team`,
    `remix` and `resume` from its query today, so the link needs a new
    query parameter that preselects a historical jersey on a blank team;
    that work belongs to #175.

11. **The artwork is credited.** Cropping the top band removes the
    `bballjerseys.com` watermark. The `@nba.jersey.database` handle at the
    bottom stays, and the page shows "Jersey art: Basketball Jersey Database"
    under the image, linked to bballjerseys.com, during the game and on the
    reveal. The share card (#176) carries the same credit in small text. It
    is worth asking the site owner directly whether they're happy with this
    use; that is the owner's call and does not block the build.

12. **No sign-in, and streaks are kept in local storage.** Following #177:
    - The current streak counts consecutive local days **won**. A loss or a
      missed day resets it to zero, as in Wordle.
    - Also stored: best streak, games played, win rate and the guess
      distribution.
    - Every storage read and write is wrapped in try/catch. If storage is
      blocked, the game is still playable without a streak.
    - Syncing streaks to an account is a later decision, because
      `SETTINGS_SCHEMA` only allows boolean and enum keys.

13. **The archive covers the last 30 days.** Archive games count as played
    and appear in the distribution, but they never extend or break the
    current streak.

## Changes to the build issues

| Issue | Change from the issue text |
|---|---|
| #173 | Jerseys only. Selection is by position in the frozen, shuffled list (decision 6), keyed by the player's local date (decision 8), not a UTC-date hash. The guess takes a season and returns `hit`/`direction`/`band`, with no team result. |
| #174 | Jerseys only (logos dropped). The crop, one-jersey and re-encode steps from decision 5 go here. Keys are random, not content hashes. Gallery assets are unchanged. |
| #175 | A season picker only, with no `HistoricalTeamCombobox`, five attempts, the reveal and builder link from decision 10 (including the new builder query parameter that preselects a jersey), and the art credit. The Umami events stay as written. |
| #176 | The share row from decision 4, with no team result. The card carries the art credit. |
| #177 | Streaks count consecutive local days won, and archive games don't affect them (decisions 12 and 13). |

## Out of scope

- Logos as puzzles (decision 1 leaves the door open).
- Leaderboards, accounts, or syncing streaks to an account.
- Guessing the team.
- Stopping a determined cheater (decisions 5 and 9 accept this).
