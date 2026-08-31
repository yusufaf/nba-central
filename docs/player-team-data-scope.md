# TeamBuilder — Player Team Data Scope

Add real team data to the player dataset so the Add Player list can show/sort by team
and player preview cards show team abbreviation.

## Root cause (current state)

`setPlayersData` Lambda scrapes BBRef per-letter index pages
(`/players/{a-z}/`) which **have no team column**. Team is hardcoded:

```ts
// setPlayersData.ts:66
team: { full_name: "", abbreviation: "" },
```

Result: all 5416 players in `players.json` have empty team → every player renders
"Free Agent / Retired", and the (now removed) Team Name sort was a no-op.

## Data source

BBRef **season** pages carry team per player:
`https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html`

- Table `#per_game_stats`, one row per player-team-season (~958 rows for 2025).
- Each row: `data-append-csv="<playerId>"` (same id as `players.json`) and
  `data-stat="team_name_abbr"` → `<a>OKC</a>` (real team) or plain `2TM`/`3TM`
  for traded-season aggregate rows.

Joining season pages to `players.json` by player id yields team for everyone who
played that season. Iterating seasons **newest→oldest** and keeping the first
team seen per player = that player's **most recent (last) team**.

## Decision: full team history per player (chosen)

Scrape **all** seasons (~1947–present, ~79 pages) and record **every franchise a
player played for**, most-recent first. This is the same full scrape needed for
"last team", so collecting the full list is nearly free — and it also satisfies
the original Team Builder ask ("none of the teams a player played for is listed").

Data shape per player:
```jsonc
{
  // ...existing fields...
  "team":  { "full_name": "Los Angeles Lakers", "abbreviation": "LAL" }, // most recent (back-compat: drives sort + preview card)
  "teams": ["Los Angeles Lakers", "Miami Heat", "Cleveland Cavaliers"]    // all, most-recent first, de-duped
}
```
- `team` = `teams[0]` resolved to full object; keeps the existing
  `team.full_name`/`team.abbreviation` consumers working unchanged.
- `teams` = list of full names (strings) for a "Teams played for" display.
- Players with no season match (pre-1947 / data gaps) → `team: {"",""}`,
  `teams: []` → still render "Free Agent / Retired".

(Rejected alternative — "current team, active players only, ~2 season pages":
lighter run but no history and retired players stay teamless. Not what we want.)

## Backend changes

### `setPlayersData/src/setPlayersData.ts`
1. Keep existing per-letter scrape (id, name, pos, height, weight, active).
2. New pass: fetch season per_game pages from `currentYear` down to 1947.
3. Parse each season page: for each row, read player id + `team_name_abbr`.
   - Skip aggregate rows (`/^\d+TM$/` → `2TM`,`3TM`).
   - Accumulate per player an **ordered, de-duped team list**. Iterate seasons
     newest→oldest; append a franchise the first time it's seen for that player →
     `teams` ends up most-recent-first with no consecutive/duplicate repeats.
4. Map abbreviation → full name via static franchise map (below). Build
   `teams: string[]` (full names) and `team` = first entry as `{full_name, abbreviation}`.
5. Players never found in a season page keep `team: {"",""}`, `teams: []`.

Pacing/limits:
- Existing delay `REQUEST_DELAY_MS = 2800`. 26 letters + ~79 seasons ≈ 105
  requests × 2.8s ≈ **~5 min**. Under BBRef ~20/min and under Lambda 15-min max,
  but **bump Lambda timeout to ~10 min and memory ~512–1024 MB** (season pages are
  ~2.3 MB each; parse + discard per page, don't hold all in memory at once).

### Franchise abbreviation → full name map
New constant (e.g. `constants/teams.ts`), ~50 entries to cover historical codes:
current 30 (`OKC`→Oklahoma City Thunder, `MIL`→Milwaukee Bucks, …) plus relocations
/renames BBRef still emits for old seasons (`SEA`,`NJN`,`CHH`,`VAN`,`NOH`,`NOK`,
`WSB`,`KCK`,`SDC`, etc.). Unmapped code → fall back to abbreviation as full_name.
Required (historical depth is in scope).

### CDK
- `team-builder.ts` / construct wiring for `setPlayersData`: raise `timeout` and
  `memorySize` (option A only). Confirm EventBridge schedule still fits.
- No new resources; still writes single `players.json` to static-data bucket.

## Frontend changes (small)

Data shape unchanged (`team.full_name` / `team.abbreviation` already consumed), so
mostly re-enabling UI removed earlier:

1. `AddPlayerDialog.vue`: restore the **Sort by Team Name** option (revert the
   single-label change back to a `Select` with `['Alphabetic','Team Name']`, and
   re-add the Team Name sort branch, sorting on `team.full_name`). No team → last.
2. Preview card already shows `team.abbreviation` when present — no change.
3. Add Player list rows: show `team.full_name` when present (already conditional
   over "Free Agent / Retired").
4. **"Teams played for"** display using the new `teams: string[]` — e.g. on the
   player preview card (back/flipped side) or the stats dialog header. Add the
   `teams?: string[]` field to the frontend `Player` type. Satisfies original
   Team Builder request #4.

## Edge cases / risks

- **Traded seasons** (`2TM/3TM`): skip aggregate rows; take real team. (~80/yr.)
- **Abbreviation drift** across eras (relocations). Mitigated by franchise map +
  abbreviation fallback.
- **BBRef rate limiting / HTML drift**: existing UA + delay reused; parser keyed on
  `data-stat` attrs (stable). Wrap each page in try/catch (existing pattern).
- **Lambda cost/time** for option A — one scheduled run, acceptable.
- **Active flag staleness**: `active` based on index `year_max`; team source is
  season pages — both from BBRef, consistent.

## Effort estimate

~1–1.5 days: `setPlayersData` season pass (full history accumulation), historical
franchise map, Lambda timeout/memory bump, frontend re-enable + "teams played for"
UI, testing across eras.

## Open decisions (resolved)

1. ~~Semantics~~ → **full team history list** per player (`teams: string[]` +
   `team` = most recent for back-compat). ✅
2. Restore "Sort by Team Name" UI once data exists → **yes**. ✅
3. ~~History depth~~ → **keep full list**, also powers a "Teams played for" UI. ✅

## Build order (when greenlit)

1. Backend: `setPlayersData` season-scrape pass + `constants/teams.ts` franchise map.
2. CDK: bump `setPlayersData` timeout/memory; deploy; trigger the Lambda once;
   verify `players.json` (spot-check LeBron `teams`, a traded player, a retiree).
3. Frontend: restore Team Name sort, add `teams` to `Player` type + "Teams played
   for" display.
4. Verify end-to-end in the running app.
