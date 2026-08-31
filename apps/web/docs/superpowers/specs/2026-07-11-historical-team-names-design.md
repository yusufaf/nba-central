# Historical Team Names Dropdown — Design

## Problem

Team Builder lets users set a custom Team Name, City, and Country in
`TeamCustomizationDialog.vue`, but City/Country are free-text fields with no
help for users who want to theme their team after a real NBA franchise
identity — including ones that no longer exist (e.g. St. Louis Hawks, Seattle
SuperSonics, Minneapolis Lakers).

This adds a searchable dropdown of every distinct team name that has existed
in NBA/BAA history, from the 1946 founding through today's 30 active teams,
that auto-fills City/Country when a name is picked. It is additive to the
existing free-text "Team Name" field in `TeamBuilderHeader.vue` — it does not
replace or affect it.

## Non-goals

- No backend/API changes. `CreateTeamPayload` (name/description/city/country/logo)
  is unchanged — the picked historical name itself is not persisted anywhere.
- No franchise-lineage grouping or year ranges shown in the list (e.g. not
  "Charlotte Hornets (1988–2002)" vs "(2014–present)") — duplicate name
  strings across eras of the same franchise are merged into a single entry.
- No changes to the free-text Team Name field or its behavior.

## Data

New static file: `src/assets/data/nbaHistoricalTeams.json`, following the same
shape convention as the existing `nbaTeams.json`. Each entry:

```json
{ "name": "St. Louis Hawks", "city": "St. Louis", "country": "USA" }
```

- Covers BAA (1946) through present, including all 30 current teams and every
  former relocated/renamed identity (e.g. Minneapolis Lakers, Ft. Wayne
  Pistons, Syracuse Nationals, Rochester/Cincinnati Royals, Seattle
  SuperSonics, Vancouver Grizzlies, original Charlotte Hornets, New Orleans
  Hornets, etc.), plus short-lived BAA-only clubs that later folded (Anderson
  Packers, Sheboygan Red Skins, Providence Steamrollers, etc.).
- `country` is `"USA"` for all entries except Canadian-based teams (Toronto
  Huskies, Toronto Raptors, Vancouver Grizzlies) which are `"Canada"`.
- Deduplicated by exact `name` string: if two distinct franchise stints share
  an identical name (e.g. "Charlotte Hornets" 1988–2002 and 2014–present, or
  the two distinct "Baltimore Bullets" clubs), only one entry is authored,
  using that name's associated city/country (which is the same in both known
  cases, so no conflict exists in practice).
- Dedup is enforced by hand-authoring the JSON correctly; no runtime
  dedup/validation logic is added, since the data is static and doesn't
  change at runtime.
- Sorted alphabetically by `name`.

## Component

New `src/components/TeamBuilder/HistoricalTeamCombobox.vue`:

- Uses the existing shadcn `Popover` + `Command`/`CommandInput`/`CommandItem`
  primitives (already present in `src/components/ui/`) to render a searchable
  combobox button — the standard pattern for a filterable select with 100+
  options, versus a plain `<select>` or the existing `DropdownMenu` (neither
  of which support text filtering).
- Trigger button shows the current selection or a placeholder ("Select
  historical team...").
- Emits the selected entry (`{ name, city, country }`) via a `@select` event.
  Selection state is local to the component (not a `defineModel`) — it does
  not track or persist which name was chosen beyond emitting it once.

## Wiring into `TeamCustomizationDialog.vue`

- Add `HistoricalTeamCombobox` above the existing City field.
- On `@select`, the dialog directly sets its existing `teamCity` and
  `teamCountry` model refs (`teamCity.value = entry.city`,
  `teamCountry.value = entry.country`). These are already `defineModel`s
  wired up to `TeamBuilder.vue`, so no new props/emits/state are needed there.
- User can still freely edit City/Country by hand afterward, as today.
- `teamName` (in `TeamBuilderHeader.vue`) is untouched by this feature.

## Risks / caveats

The JSON is hand-compiled from general NBA/BAA historical knowledge rather
than pulled from an authoritative API (none is wired into this project for
historical data). Modern-era names (1949 merger onward) are well-known and
low-risk; some of the single-season 1946–49 BAA-only franchises are more
obscure and worth a quick human spot-check after implementation in case a
city/name/spelling is slightly off.

## Testing

No test framework exists in this project (no vitest/jest config, no
`*.spec.*`/`*.test.*` files) — verification is manual, consistent with the
rest of the codebase:

- Search filters correctly (e.g. "Sonic", "Bullets", "Charlotte").
- Exactly one "Charlotte Hornets" entry appears despite two franchise eras.
- Selecting an entry fills City/Country and doesn't touch Team Name.
- Manually edited City/Country after a selection are preserved (not
  overwritten) until another historical name is picked.
- Existing dialog features (description, logo picker, jersey canvas)
  unaffected.
