# 3D builders: team scene, people creators, arena parts

**Date:** 2026-11-05
**Status:** design for review, not yet implemented
**Issue:** #119 (to become the epic)
**Spike:** draft PR #284 (`/dev/3d-spike` on its preview; throwaway, never merged)
**Review board:** https://claude.ai/artifact/8CnYArdk5weyQ6fnc3Z7h6
**UI mockups (Stitch):** https://stitch.withgoogle.com/projects/6401965995820230190
(390px screens: player creator `e8c32ba6306e4d5baa02f4bd6d3f6b97`, coach
outfit `9dffc55104794645a1ccc123199afad3`, 3D team view
`562392dc45eb44f39a083a0d11efb7c2`, arena editor
`f9dc4fc130544fea94cf1faa7bf926d1`. They set layout and controls; their
generated 3D art is illustrative, not the target look, which is the
spike's.)

## Why

Custom players, coaches and GMs have no appearance at all today, and custom
arenas stop at a flat 2D court. This work adds a live 3D view of a team (its
starting five, coach and GM standing on its court inside its arena), 3D
appearance creators for custom people, and 3D arena parts.

It is for two reasons equally: learning 3D in the browser, and giving the
site something people want to show off. A share of a team travels as its
link preview, so the 3D share card comes right after the scene.

## Goals

- A 3D team scene for every saved team, built from data the team already
  has, on the public page and from the builder.
- A user can pick a 3D shot as the team's share card.
- Creators for custom players, coaches and GMs that work fully at 390px.
- 3D arena parts on custom arenas: seating bowl, scoreboard and ribbon
  boards, rafters banners, lighting mood.

## Non-goals and anti-goals

- No likeness of real people: no faces, skin or hair for real players,
  coaches or GMs; no photo-to-face; no face uploads. Realistic likenesses of
  real athletes are what EA lost over (Keller v. EA, 9th Cir. 2013).
- Appearance never touches ratings.
- No walking around, gameplay, or animation beyond static poses (and an
  optional idle sway).
- No replicas of real NBA courts or arenas.
- The rest of the site must not get heavier: no 3D code in the entry chunk.
- The 2D views stay primary; 3D is always an extra.

## Decisions

### Made by the owner

1. **Art style: stylized athletic**, in the spirit of NBA 2K Playgrounds,
   not realistic.
2. **Where 3D lives:** a live team scene plus the creators. Elsewhere the
   2D cards stay.
3. **Real people are neutral figurines:** one matte "vinyl" material, no
   skin or hair choice, a body built from their real height, weight and
   position, wearing the team's uniform. Custom people get full appearance.
4. **Bodies: the free CC0 kit only.** Quaternius Universal Base Characters,
   free tier: two athletic bodies (male and female) and eight hair and brow
   meshes. Everyone, players and staff, uses these two bodies; staff look
   different through reshaping, outfit and hair. The paid "Source" tier is
   not bought.
5. **Male and female bodies from day one.**
6. **No Blender for the owner.** Assets are processed by scripts.
7. **Coach and GM use the same creator as players**, plus outfit (suit,
   polo, tracksuit), outfit colours, glasses and an age look.
8. **Full editing at 390px**, like the court designer.
9. **The arena builder adds** a seating bowl, scoreboard and LED ribbon
   boards, rafters banners and a lighting mood, on top of the existing 2D
   court design.
10. **Camera:** orbit plus preset shots (team photo, courtside, broadcast,
    rafters). No walking.
11. **Share card:** the user chooses a 2D card or a 3D scene shot when
    publishing.
12. **Uniform colours** are sampled from the team's jersey image; the owner
    can override them, and the override is stored on the team.
13. **The scene has its own shareable link**, as `/t/:uuid?view=3d` (see
    decision 18).
14. **Order:** team scene → 3D share card → player creator → coach/GM
    creator → arena parts.

### Made in this design (the owner delegated them)

15. **Plain three.js, not TresJS.** Bodies, uniforms, the bowl and the
    scoreboard are generated from data by imperative builders, so TresJS's
    declarative templates add little; plain three.js has far more examples
    and teaches the real API. The cost is owning the renderer lifecycle,
    which is one composable.
16. **Uniforms are painted on, not modelled.** The body's own material is
    patched in its shader: regions come from skin weights (arms, legs,
    head, hands) and horizontal planes through the joints (hips, knees,
    ankles, shoulders, neck), and name and number are projected onto the
    chest and back from the rest pose. The spike also tried a shell (the
    same regions lifted off the body), at the same triangle count; it gave
    looser shorts but flared into fins at the hips. Painted-on is chosen
    because one technique covers jerseys, figurines and suits, adds no
    mesh, and can't poke through. If the tight shorts look wrong in use, a
    shell for the shorts alone is the follow-up.
17. **Bodies are reshaped in the rest pose.** Each bone gets a linear map
    about its origin (stretch along the bone, girth across it); the map is
    baked into the vertices by skin weight, the joints move, and the
    inverse bind matrices are recomputed. Scaling bones directly skews
    rotated children. Height is a uniform scale of the whole character.
    Girth comes from weight relative to height; wingspan stretches the
    arms; shoulders stretch the clavicles.
18. **The scene is `?view=3d` on the existing public page.** CloudFront
    sends `/t/*` to API Gateway, which has only the one-segment
    `/t/{teamUUID}` route, so a `/t/:uuid/3d` path would 404 into the plain
    SPA shell and lose the team's OG tags. On `PublicTeam.vue`,
    `?view=3d` mounts the scene as an async component.
19. **One shared WebGL renderer** for every 3D surface (iOS caps live
    contexts), with context-loss handling, a disposal walk on unmount, and
    module-level caches of the loaded models.
20. **Real players without a height or weight** (the snapshot's fields can
    be null) get the median for their position.
21. **Jersey numbers are strings** ("00" is a real number). A custom
    player's number lives in their appearance; the team can set a number
    per roster slot, and the roster number wins. Real players have no
    number unless the owner sets one; the team name goes on the front.
22. **On portrait screens the team stands in two rows** with a wider lens,
    or the camera backs into the stands (seen in the spike).
23. **Parts the free kit lacks are simple code-built geometry.** The kit
    has hair (buzzed, buzzed F, parted, long, buns), one beard and two
    brows. Glasses, goggles, a headband and an arm sleeve are small
    procedural meshes parented to the head or forearm bone, in the same
    stylized look. Facial hair is "none" or "beard" only. The age look
    changes hair colour (grey at "veteran", streaked at "prime") and adds a
    little girth at "veteran"; it changes no face. Anything not on these
    lists is out until an asset exists.
24. **Editing a custom player updates their teams on next open.** Because
    players are snapshotted, the builder refreshes the snapshots of the
    owner's own custom players from their current items when a team loads,
    and the next save stores the new look. Public pages show the look as of
    the last save. Coaches and GMs are live already.
25. **A missed performance budget hides the phase, it doesn't ship it.**
    After Phases 1, 3 and 5 the emulated gate reruns. A miss keeps that
    phase's entry point behind the dev/preview flag until fixed. Cuts, in
    order: idle sway and blob shadows, the upper deck, hair on figurines
    (already none), then texture size. The creator loads only the hair and
    accessories the user opens, not all of them up front.

## How appearance reaches the scene

- **Players: snapshot.** `toSnapshot`
  (`apps/web/src/composables/useTeamPersistence.ts`) already copies the
  whole player onto the team, and the server checks only `fullName`
  (`apps/cdk/utilities/team-validation.ts`). A shared `appearanceError`
  validates `appearance` inside `validateTeamData`, copying known keys
  only. The appearance then survives deleting the custom player, and
  remixes, the same way the name does.
- **Coach and GM: resolved live.** A team stores only
  `{ name, isCustom, uuid }` for them. A `resolveEntity`, mirroring
  `resolveArena` (`apps/cdk/resources/dynamo/arenas.ts`), reads the
  owner's coach or GM item on `getTeam` and `getPublicTeam`; a missing one
  falls back to a figurine. It must handle the known `uuid` vs
  `coachUUID` naming mismatch noted in the custom-arenas spec.
- **Venue: live with the arena.** `venue` sits on the custom arena item and
  is lost on remix, as the court already is (custom-arenas decision 3).
- **Web:** one `parseAppearance(unknown)` fills defaults, so a malformed
  public snapshot can't break the scene.
- Export and delete need no change: both read the whole partition.

## Data shapes

IDs are `as const` arrays in `apps/cdk/models/custom-entities.ts`, like
`COURT_WOODS`, with a test that each ID has an asset. A new ID ships CDK
first, then web.

```ts
export interface PersonAppearance {
	version: 1;
	frame: "m" | "f";
	skin: string;                                  // #rrggbb
	hair: { style: HairStyleId; color: string };   // "none" allowed
	facialHair: { style: FacialHairId; color: string };
	build: {
		girth: number;                             // -1..1, added to the weight-derived girth
		shoulders: number;                         // -1..1
		wingspan: number;                          // -1..1
		heightIn?: number;                         // staff only, 60..90
	};
	accessories: AccessoryId[];                    // ≤ 4: headband, arm sleeve, goggles, glasses
	outfit?: { style: "suit" | "polo" | "tracksuit"; primary: string; secondary: string }; // staff
	ageLook?: "young" | "prime" | "veteran";       // staff
	jerseyNumber?: string | null;                  // players: "0".."99", "00"
	pose: PoseId;
}
// appearance?: PersonAppearance on CustomPlayerItem, CustomCoachItem, CustomGMItem

export interface VenueDesign {                     // venue?: on CustomArenaItem
	version: 1;
	seats: { primary: string; secondary: string; pattern: "solid" | "sections" | "rows" | "gradient" };
	upperDeck: boolean;                            // bowl depth also scales with capacity
	scoreboard: { text: string; accent: string };  // text ≤ 16
	ribbon: { text: string; color: string };       // text ≤ 32
	banners: { kind: "title" | "number"; title: string; subtitle: string; color: string }[]; // ≤ 8; title ≤ 16, subtitle ≤ 24
	lighting: { preset: "broadcast" | "theater"; tint: string };
}

// SavedTeam: uniform?: { primary: string; secondary: string; trim: string }; cardStyle?: "2d" | "3d"
// TeamRosterEntry: number?: string | null
```

## Rendering

- `apps/web/src/three/` holds framework-free TypeScript: `renderer/`,
  `character/`, `arena/`, `scene/`. Mappers and maths are unit-tested
  without WebGL. One `ThreeViewport.vue` hosts a scene.
- Everything 3D enters through `defineAsyncComponent` or `import()`, like
  the DiceBear avatars (`useAvatar.ts`) and the lazy game routes. An ESLint
  `no-restricted-imports` rule keeps `three` inside `src/three/**`, and a
  post-build check fails if the entry chunk contains `WebGLRenderer`.
- Frames render on demand. Pixel ratio is capped at 1.5. Idle sway, camera
  moves and the ribbon scroll follow `useReducedMotion()` and are off by
  default on phones.
- The floor is the team's `CourtFloor`, rasterised offscreen with
  html-to-image's `toCanvas` (which inlines the logo and drawing), as a
  `CanvasTexture`. A logo that blocks cross-origin reads falls back to the
  court without it. Teams on a built-in arena get a neutral default court.
- Accessibility: the canvas has `role="img"` and a label listing the
  people; camera preset and rotate buttons are the keyboard path; names
  show as chips in the HUD.

## Assets

- A Node script (`apps/web/scripts/build-3d-assets.ts`, using
  `@gltf-transform/*`) turns the Quaternius glTF files into compact GLBs:
  prune, meshopt, WebP textures. The processed GLBs are committed under
  `apps/web/src/three/assets/` and imported with `?url`, so Vite hashes
  them and they work in PR previews.
- **Meshopt quantization hides a scale in the inverse bind matrices.**
  Anything that recomputes those (reshaping, rebinding hair) loses it, so
  meshes are dequantized back to float positions once at load.
- **`Skeleton.clone()` shares its `boneInverses` array**, and
  `calculateInverses()` empties it in place, so each clone copies its
  inverses before reshaping.
- The rig is the UE mannequin naming (`pelvis`, `spine_01`, `upperarm_l`,
  ...), in T-pose, Y-up, 1.81 m tall.
- `THIRD_PARTY_NOTICES.md` lists three.js (MIT), meshoptimizer (MIT) and
  Quaternius (CC0). Mixamo is not used: its raw files may not be
  redistributed, and a web app ships them to the browser.

## Share card

The 3D frame renders as a background inside `ShareCard.vue`, so
`renderCardPng` and the text overlay are unchanged. The shot is always the
fixed team-photo preset, so nothing about the camera is stored on the team.

**A team on the 3D card re-renders it on every save that re-publishes**
(owner's decision, 2026-11-05): the silent re-publish in `TeamBuilder.vue`
loads the 3D chunk, renders the team-photo frame offscreen with the shared
renderer, and publishes it, so the link preview always matches the team.
The last frame is kept in memory with a hash of the scene's inputs and
reused when nothing in the scene changed. If the 3D render fails or WebGL
is missing, that save publishes the 2D card and the team keeps
`cardStyle: "3d"`, so the next save tries again. Saving shows the same toast
as today; the render runs after the save itself succeeds, so a slow render
never blocks or fails the save.

The card render never touches the visible scene: it draws into its own
1200x630 `WebGLRenderTarget` with its own camera, reads the pixels back
(`readRenderTargetPixels`) into a 2D canvas, and leaves the shared
renderer's size, pixel ratio and viewport alone. A 3D view open during the
save doesn't flicker or resize.

The spike's 1200x630 frames were 191–405 KB as PNG, well under
`publishTeam`'s 2 MB limit, so PNG stays.

## Phases

Each is its own issue set, plan and PR, with Umami events through `track`.

1. **Team scene (web only).** Shared renderer, viewport, the seven people
   as figurines with sampled uniform colours, court floor, simple bowl,
   camera presets, entry points on the public page (`?view=3d`) and the
   builder's Starting Lineup header, the asset script and notices. Events
   `scene3d_opened`, `scene3d_failed`, `scene3d_preset`.
2. **3D share card.** `cardStyle` and `uniform` on the team (validation,
   `updateTeam`, CDK deploy first), the publish choice, re-render on save
   with the in-memory frame cache and the 2D fallback.
3. **Player creator.** `appearance` through create, update and list,
   roster snapshot validation, roster numbers; the creator as a
   `DialogContent size="sheet"` editor with the canvas on top and tabs
   below (Body, Face, Hair, Gear, Pose); presets first, then sliders; a
   hex input on every colour; the preview lit like the arena.
4. **Coach and GM creators.** Staff mode (outfit, glasses, age look,
   height), `appearance` on both items, `resolveEntity`.
5. **Arena parts.** `venue` on custom arenas, Seats, Scoreboard, Banners
   and Lighting tabs with a 3D preview; instanced or batched seats.

## Spike results (2026-11-05)

Measured against the PR #284 preview at 412x915, Chromium with the CPU
slowed 4x and a Fast-4G network, and Firefox:

| Check | Result | Budget |
| --- | --- | --- |
| Lazy 3D chunk (gzip) | 179 KB | 300 KB |
| Character assets | 1.29 MB | 3 MB |
| Draw calls / triangles, team scene | 29 / 114k | 60 / 150k |
| p95 frame time, hardware GPU, CPU 4x slower | 3.5 ms | 33 ms |
| First frame, cold load of the whole app | 3.9–4.6 s | 4 s |
| Card frame (PNG / JPEG) | 191–405 KB / 87–108 KB | 2 MB |

Firefox renders the same with no errors. Frame time on a real phone GPU is
not measured (it can't be emulated on a desktop); the CPU side is light, so
the phone's GPU decides. First frame is borderline, but it counts loading the
entire app from cold; opening the scene from an already-loaded team page
skips most of that, and Phase 1 loads only the bodies and hair a team uses.

## Verification

- Every phase passes CI's web and CDK jobs (lint, type-check,
  check:styles, test, build; cdk build, test, synth).
- Unit tests: appearance and venue validators, `appearanceError` in team
  validation, `parseAppearance` defaults, reshaping maths, colour sampling,
  bowl layout, ID arrays against the asset manifest.
- Bundle: the import rule, the entry-chunk check, and a size comparison.
- A Playwright smoke spec opens `?view=3d` with the `public-team.json`
  fixture and checks for a non-blank canvas and no console errors
  (`--enable-unsafe-swiftshader`); no pixel-diff baselines for WebGL.
- After Phases 1, 3 and 5, rerun the emulated gate, and a real phone when
  one is at hand.

## Left to the builder

Exact presets and slider ranges, the pose library's contents, HUD layout
details within the Stitch mockups, how the bowl draws seats, and the shade
of the figurine vinyl.
