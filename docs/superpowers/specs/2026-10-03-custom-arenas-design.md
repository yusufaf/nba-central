# Custom arenas: design decisions

**Date:** 2026-10-03
**Status:** approved design, not yet implemented
**Issue:** #115 (epic #114; build slices #116, #117, #118)
**Review page (mocks):** https://claude.ai/artifact/5Uha1PyfBnTnZb23BLvwYC

## Why

A user can only pick one of the 30 bundled NBA arenas, and a saved team keeps
just the arena's name and image, so capacity, location and opened year are
silently dropped. Epic #114 lets users create their own arena, design its
court floor, and draw on it. This spec settles the decisions every build
slice depends on: the data shapes, where images live, how the court is drawn
and where it shows, and how custom arenas sit next to the built-in ones.

The review page has mocks of every surface in both themes and at 390px, made
against the real app and the real `main.css` tokens.

## Decisions

1. **A team links to a custom arena and keeps a text copy of it.** The team
   stores the arena's `arenaUUID` plus its name, location, capacity and opened
   year. The photo and court are read live from the arena item: `getTeam` and
   `getPublicTeam` do one extra GetItem on the team owner's partition. Editing
   an arena updates every team that uses it, and no team ever stores an image
   URL that a delete could break. The cost is that one extra read.
2. **Built-in arenas save their full details too.** `capacity` becomes a
   number, and `location` and `openedYear` are kept. Saved teams that only
   have `{ name, imgLink }` get the missing fields filled from the bundled
   `arenas.json` by exact name when they load, and those are written back on
   the next save. There is no migration script.
3. **A deleted or foreign arena leaves the text behind.** If the arena behind
   a link is gone, the team shows its name and details with no court or
   photo. On save, the server drops any `arenaUUID` that isn't in the caller's
   own partition. That covers deleted arenas and remixes of someone else's
   team that used their custom arena (`loadRemixFromRoute` copies the arena
   ref as-is). Nothing fans out across teams on delete.
4. **The public page gets display fields only.** `getPublicTeam` returns the
   resolved arena (name, location, capacity, opened year, photo, court
   settings, logo, drawing) and never the item keys or `createdBy`. S3 keys
   use the arena's uuid, not the owner's `sub`, so no image URL shows whose
   arena it is.
5. **Images go to S3 under `arenas/<arenaUUID>/`, and the court is stored as
   settings only.** There are three image slots (photo, centre logo, drawing),
   with one object per slot. Each is PNG, JPEG or WebP, checked by file
   signature, with a 1 MB limit. This copies `uploadAvatar`, whose
   `detectImageType` moves to a shared utility. No rendered court PNG is
   stored: every surface draws it live, and the share card (already stored
   under `cards/`) is the only raster. Each user can have up to 20 custom
   arenas.
6. **The court is drawn from settings, in SVG.** There are seven settings:
   floor wood (5 presets), paint, apron, lines, centre logo, baseline text and
   sideline text. One SVG source scales from a thumbnail to the 1200px share
   card, keeps text as text, and `html-to-image` rasterises it with the rest
   of the card in one pass. The plank texture is generated from a seed, so the
   floor loads nothing cross-origin. Text colour is not a setting: it is
   picked at render time for at least 4.5:1 against the apron.
7. **The court is a floor behind the starting five.** In the builder and on
   the public page it is tilted back like a broadcast camera (CSS
   perspective), and the player cards stay opaque in front of it. On a phone
   it is a band above the first card. The share card uses the flat court with
   a dark scrim. The court's colours are user content and identical in light
   and dark; only the frame around it (the stage gradient, the scrim) follows
   the theme, and the share card keeps `.dark`. Built-in arenas have no court,
   so those surfaces look the same as today.
8. **One Arena drawer, and #60 goes to the bundled data.** "Create arena" sits
   under the drawer title, as "Create Custom Coach" does. "Your arenas" is
   pinned above "NBA arenas", with court thumbnails (or the photo when there
   is no court), a Custom badge, and edit and delete. Search covers both
   groups. The conference filter applies to NBA arenas only, and hides your
   arenas while it's on. For #60, the bundled JSON is the source of truth for
   arenas, coaches and execs, and `setArenasData`, `setCoachesData`,
   `setExecsData` and their S3 writes are deleted. That fix ships as its own
   PR, and nothing in #116 depends on it.
9. **Phones can edit everything except the drawing.** At 390px the dialog is
   full screen, with the preview pinned at the top, the controls stacked, and
   the buttons fixed at the bottom. Below a 40rem container width (a container
   query, so it follows Text size), the Drawing tab shows the drawing
   read-only, with Clear.
10. **#116, #117 and #118 keep their split.** The image endpoint is built once
    in #116 (photo slot), and #117 (logo) and #118 (drawing) reuse it.

## Data shapes

### The custom arena item and its court

```ts
// apps/cdk/models/custom-entities.ts
export interface CustomArenaItem {
	PK: string;                // userUUID#<sub>
	SK: string;                // customArena#<arenaUUID>
	entityType: "customArena";
	created: string;
	updated: string;
	arenaUUID: string;
	name: string;              // 1–60 chars, trimmed
	location: string;          // same field name as arenas.json; ≤ 60, may be ""
	capacity: number | null;   // integer 1–200,000
	openedYear: number | null; // 1850–2100 (future years allowed)
	court: CourtDesign | null; // null = no court drawn yet
	photoUrl?: string;   photoKey?: string;    // #116
	logoUrl?: string;    logoKey?: string;     // #117, used when court.centerLogo === "upload"
	drawingUrl?: string; drawingKey?: string;  // #118
	createdBy: string;
}

// Settings only - every surface draws it. Hex colours are user content, not tokens.
export interface CourtDesign {
	version: 1;
	wood: "maple" | "honey" | "walnut" | "ash" | "ebony";
	paint: string | null;      // #rrggbb for the keys and centre circle; null = unpainted
	apron: string | null;      // #rrggbb for the out-of-bounds band; null = stained wood
	lines: string;             // #rrggbb
	centerLogo: "none" | "team" | "upload";  // "team" = the logo of whichever team plays there
	baselineText: string;      // ≤ 20 chars, "" = none
	sidelineText: string;      // ≤ 24 chars, "" = none
	// No text colour: chosen at render for ≥ 4.5:1 against the apron.
}
```

### API

Routes follow the custom coach pattern under `/api/custom-entities/arena/*`
(`create`, `list`, `update`, `delete/{arenaUUID}`), plus the image endpoint.

```ts
// apps/cdk/models/api/custom-entities-api.ts
export interface CreateCustomArenaPayload {
	name: string; location: string; capacity: number | null; openedYear: number | null;
	court: CourtDesign | null;
}
export interface UpdateCustomArenaPayload extends CreateCustomArenaPayload { arenaUUID: string }

export interface CustomArenaListItem {
	arenaUUID: string; name: string; location: string;
	capacity: number | null; openedYear: number | null;
	court: CourtDesign | null;
	photoUrl?: string; logoUrl?: string; drawingUrl?: string;
	created: string;
	isCustom: true;
}

// PUT /api/custom-entities/arena/{arenaUUID}/image   (the avatar upload's shape)
export interface UploadArenaImagePayload {
	slot: "photo" | "logo" | "drawing";
	image: string;             // base64, no data: prefix
}
export type UploadArenaImageResponse = ApiResponse<{ url: string }>;
// DELETE /api/custom-entities/arena/{arenaUUID}/image/{slot} removes one.
```

### A team's arena reference

The stored shape and the shape readers get back are separate types, so a
resolved photo or court can never be saved back onto the team.

```ts
// apps/cdk/models/api/teams-api.ts - what the team item stores
export interface TeamArenaRef {
	name: string;
	location?: string;         // kept for built-in and custom
	capacity?: number;         // "19,200" from arenas.json is parsed when the ref is built
	openedYear?: number;
	imgLink?: string;          // built-in only: the Wikimedia 500px thumbnail
	isCustom?: boolean;        // absent = built-in (every row saved before this ships)
	arenaUUID?: string;        // custom only, and only ever the team owner's own arena
}

// What getTeam and getPublicTeam return in `arena`: the ref plus the live arena.
export interface ResolvedArena extends TeamArenaRef {
	court?: CourtDesign;
	photoUrl?: string;
	logoUrl?: string;
	drawingUrl?: string;
	missing?: true;            // the arenaUUID no longer resolves: show the text only
}

// SaveTeamPayload.arena: TeamArenaRef | null
// SavedTeam.arena, PublicTeam.arena: ResolvedArena | null
```

### Rules

- **Save** (`createTeam`, `updateTeam`): if `arenaUUID` is set, GetItem
  `userUUID#<caller sub>` / `customArena#<arenaUUID>`. If it's found, the text
  fields are copied from the item. If it's not found, the link is dropped and
  the client's text is kept with `isCustom: true` and no uuid. Resolved fields
  (`court`, `*Url`) are never stored.
- **Read** (`getTeam`, `getPublicTeam`): one shared
  `resolveArena(ownerUUID, ref)`. The public reader has the team item's
  `userUUID` before `toPublicTeam` strips it, so the lookup always uses the
  owner and never the viewer.
- **Legacy rows** (`{ name, imgLink }`): `hydrateTeam` fills `location`,
  `capacity` and `openedYear` from `arenas.json` by exact name. If there's no
  match, the name is shown alone, as it is today.
- **The builder** resolves from the same `useCustomArenas` list the drawer
  uses, so editing the court updates the stage without a refetch.
- **Share card**: `ShareCardProps` gains `court`, `courtLogoUrl`,
  `courtDrawingUrl` and `arenaName`, taken from the resolved arena in
  `toShareCardProps`.
- **One id name.** The arena is `arenaUUID` on both sides. Custom coaches show
  why: a hydrated `EntityRef` carries `uuid`, but `CoachSection` compares
  `teamCoach.coachUUID`, so deleting a custom coach doesn't clear it from a
  reloaded team (existing bug, out of scope here).

## Storage and limits

All images live in the assets bucket behind the assets CDN, which sends CORS
headers, so the share card's canvas stays clean. Keys are timestamped, as
avatars are, because the CDN caches each object for a year: a replaced image
gets a new URL instead of an invalidation.

| What | Where | Format | Client prepares | Server limit | Removed by |
| --- | --- | --- | --- | --- | --- |
| Arena photo (#116) | `arenas/<arenaUUID>/photo-<ms>.<ext>` | PNG, JPEG, WebP | Resized to a 1600px long edge | 1 MB decoded | Replace, DELETE slot, arena delete, Delete my data |
| Centre logo (#117) | `arenas/<arenaUUID>/logo-<ms>.<ext>` | PNG, WebP, JPEG | 512×512 max | 1 MB decoded | Same |
| Court drawing (#118) | `arenas/<arenaUUID>/drawing-<ms>.png` | PNG (transparent) | Strokes only, 2× the court's viewBox | 1 MB decoded | Same, plus Clear |
| Court design (#117) | `court` on the arena item | JSON settings | — | enums, `#rrggbb`, 20 and 24 chars | With the item |
| Arena item (#116) | main table, `customArena#` | DynamoDB item | — | ~1–2 KB, 20 per user | Arena delete, Delete my data |
| Share card (existing) | `cards/<teamUUID>/<ms>.png` | PNG 1200×630 | Now with the court drawn in | unchanged | Unchanged |

- **Validation** copies `uploadAvatar`: the type comes from the file
  signature, never from a filename or a client Content-Type. GIF and SVG are
  refused. The base64 length is checked before decoding. Ownership is a
  GetItem on the caller's own `customArena#` item first, so a guessed uuid
  can't write into another user's prefix.
- **`deleteCustomArena`** deletes the item, then lists and deletes
  `arenas/<arenaUUID>/` and invalidates those paths (`listKeys`, `deleteKeys`,
  `invalidateKeys` in `utilities/assets-objects.ts`).
- **`deleteUserData`** adds `arenas/<arenaUUID>/` for each `customArena#` item
  to its step-2 prefix list, next to the team cards. As with cards, those keys
  can only be found while the items still exist.
- **`deleteTeam`** doesn't change: a team owns no arena images.
- **Export** gets a `customArenas: ExportedItem[]` kind (`customArena#` in
  `USER_ITEM_KINDS`), with the court settings and image URLs, as `avatarUrl`
  and `cardUrl` are today. The change only adds a field, so `version` stays 1.
- **CDN**: deletes are invalidated by exact path, as today. A replaced image
  isn't invalidated, because nothing references its old URL any more (the
  avatar precedent).

## Verified while designing

- The real `ShareCard.vue` with an SVG court behind it exported through the
  app's own `html-to-image` `toPng` without tainting the canvas, including a
  centre logo drawn as an SVG `<image>` from the assets CDN (a 248 KB PNG).
- `upload.wikimedia.org` sends `access-control-allow-origin: *` on the 500px
  thumbnails, so built-in arena photos are CORS-safe too.
- Nothing reads the S3 `arenas.json` that `setArenasData` writes; the drawer
  imports the bundled copy (#60's premise still holds).
- The jersey drawing flattens its template image into the PNG. The court
  drawing stores strokes only, on a transparent layer, so the court settings
  can change without losing the ink.

## Out of scope

- Fixing the custom coach id mismatch described above.
- A court for built-in arenas.
- Copying another user's arena into your own account when remixing.
- 3D arenas and players (#119).
