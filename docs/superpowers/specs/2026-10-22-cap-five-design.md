# Cap Five: design decisions

**Date:** 2026-10-22
**Status:** approved design, built in the PR that adds this file
**Issue:** #183 (milestone "Rosters and live context")

## Why

Cap Five is a second daily game built on data no other NBA daily combines:
all-time players plus their NBA 2K ratings. Each day there is a pool of
twelve players and a rating cap. The player picks five, locks the lineup in,
and sees how close they got to the cap without going over. It reuses the
builder's rating language (tiers, colours, team average) rather than a grid,
so it doesn't read as another grid game.

## What the data looks like

Measured from the live `getPlayers` API on 2026-10-22.

- **1,351 rated players**, game version `2K27`. By source: current 618,
  all-time 311, classic-peak 422.
- **Rating bands:** 65-69: 131, 70-79: 755, 80-89: 327, 90-99: 137. One
  player is below 60 (Russell Westbrook at 42, an upstream anomaly).
- **Positions:** every rated player has one or two 2K positions, spread
  evenly across PG/SG/SF/PF/C.
- **Teams:** every player's team is empty until #178 lands, so a candidate
  shows only a name, positions and an era.
- **One duplicate display name:** Bobby Jones (`jonesbo01`, 90, all-time;
  `jonesbo02`, 70, classic-peak).
- `player-ratings.json` is rewritten weekly by `setPlayerRatingsData`.

A simulation over those ratings (300 trials each) settled the pool size: with
12 players (792 lineups) and a cap drawn from the real lineup sums, a median
of 12-18 lineups hit the cap exactly. With 20 players, 90-286 do, which makes
a perfect score too easy and the list too long on a phone.

## Decisions

1. **Rules.** Pick exactly five of the day's twelve players and lock them
   in. The score is the sum of their ratings. Going over the cap is a bust.
   Ratings stay hidden until the lineup is locked in, and there is one
   submission per day.

2. **Pool.** Twelve players, stratified across rating bands: 2 from 90-99,
   4 from 80-89, 4 from 70-79 and 2 from 65-69, from every rating source
   mixed. That guarantees a couple of stars and a real spread.
   - Ratings below 65 are excluded (the Westbrook anomaly), and so is every
     player whose display name is shared with another eligible player.
   - Candidates are listed in last-name order: rating order would give the
     answer away.

3. **Cap.** Drawn from the pool's actual five-player sums, between the 35th
   and 80th percentile, and always strictly below the top-five sum. So the
   cap is always reachable exactly, and the best possible score equals it.

4. **Freezing and publishing.** A scheduled Lambda, `publishCapFive`, runs
   daily. It freezes every date from the start of the playable window to 7
   days past its end into its own object, `cap-five/<date>.json` in the
   static-data bucket, written with `IfNoneMatch: "*"` so a published day can
   never change.
   - The puzzle stores the candidates, their ratings at publish time, the
     cap, the game version and the optimal lineup. Weekly rating changes
     never touch a published day.
   - A puzzle is frozen up to about 8 days before its date from a ratings
     file up to 7 days old, so its ratings can be about 15 days old when
     played.
   - The issue's "UTC-date seed" becomes: **the puzzle's calendar date seeds
     it** (`mulberry32` over FNV-1a of `cap-five:<date>`). Days are served
     per local date, like Daily Era. The seed makes a date reproducible from
     a given ratings file; the frozen object is the source of truth.
   - The publisher refuses to write anything if fewer than 300 players are
     eligible, which means the ratings file is broken.
   - Puzzle #1 is 2026-10-22. Any past date is safe: the publisher backfills
     from the start of the window.
   - A daily schedule first fires a day after its rule is created, so the
     deploy that adds the publisher is followed by one manual invoke.

5. **Scoring and optimal.** The server scores a lineup against the frozen
   puzzle. The optimal is precomputed at publish time by brute force over
   the 792 lineups: its total (equal to the cap), one example lineup, and how
   many lineups reach it. The result reads "412 / 415".

6. **Answer secrecy.** As in Daily Era decision 9, the check happens on the
   server and the endpoints are stateless. `GET /api/daily/cap-five/{date}`
   carries no rating, rating source or optimal. `POST
   /api/daily/cap-five/submit` returns the full reveal. Probing by repeated
   submits only spoils the prober's own game, and so does looking ratings up
   in the public `getPlayers` API, the same as a reverse image search in
   Daily Era.

7. **Day boundary.** Reused from Daily Era decision 8: the player's local
   date, accepted inside the same playable window and cached for at most an
   hour. A date outside the window, before puzzle #1, or not yet published
   gets a 410, never a 403 or 404.

8. **Streak and storage.** One result per local date, kept in localStorage
   under its own versioned key. The first submission wins. The streak counts
   consecutive days played on the day without a bust; today unplayed doesn't
   break it, a bust does.

9. **Share.** Spoiler-free: the puzzle number, the score, one tier-coloured
   square per pick and the streak, for example
   `Cap Five #12 412/415 🟨🟩🟦🟦⬜ 🔥3 <url>`. Names appear only in the
   on-page reveal. The 1200×630 card shows the same, drawn as boxes rather
   than emoji.

10. **Ratings terms and credit.** api.nba2kapi.com has no terms page; its
    README licenses the code (MIT) and credits the data to 2kratings.com.
    2kratings.com's terms couldn't be read (403 to non-browser clients).
    There is no explicit permission and no prohibition. The site already
    serves every rating through `getPlayers`, so a puzzle of twelve adds no
    exposure. The game shows the site's first ratings credit: "Ratings: NBA
    2K27 via 2kratings.com, frozen for this puzzle. Not affiliated with 2K
    or the NBA."

11. **Reuse of builder pieces.** `AddPlayerDialog` and `PlayerSlot` are not
    reused: the dialog searches all 5,400 players, leads with sign-in-only
    custom players and shows ratings. The builder feel comes from
    `ratingTier`, `averageRating`, the rating colour tokens, a five-slot
    lineup tray and the shared Card, Button and Badge components.

## Out of scope

Follow-up issues: a 30-day archive UI (the server already accepts archive
dates), `/cap-five`'s own link-preview image and HTML shell, a "play this
lineup in the builder" link, linking the game from the nav or Home (launch),
syncing streaks to an account, moving `AddPlayerDialog`/`PlayerSlot` to the
new `RatingChip`, and ETL alarms (#181).
