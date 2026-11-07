# 3D Figurines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 3D team scene shows the starting five, the coach and the GM as figurines on the court, with bodies sized from their real height and weight, a painted uniform in colours sampled from the team's jersey, and name chips. Issue #287.

**Architecture:** New framework-free modules under `apps/web/src/three/character/` load one CC0 body, dequantize and clone it, reshape it in its rest pose, paint a uniform or suit in its shader, and pose it. `TeamScene` places the people and reports screen anchors for the name chips. `TeamScene3D.vue` takes a `people` list, which `PublicTeam.vue` builds from the roster, coach and GM.

**Tech Stack:** three 0.187.0 (GLTFLoader, meshopt decoder, SkeletonUtils), Vue 3.5, Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-3d-builders-design.md`. Spike code to port from (throwaway, never merged): branch `feat/3d-spike`, `apps/web/src/three/spike/{character,reshape,kit,scene}.ts`.

**Scope:** People are all figurines in this slice. Custom looks are #291, roster numbers #290, female and staff frames arrive with the creators. So only the male athletic body ships now.

## Global Constraints

- Real people are neutral figurines: one matte vinyl colour, no skin, hair or face (spec decision 3). In this slice that applies to everyone.
- Bodies are reshaped in the rest pose, never by scaling bones (spec decision 17); height is a uniform scale of the whole character.
- Uniforms are painted on in the body's shader (spec decision 16); staff wear a painted suit.
- Null height or weight uses the median for the position (spec decision 20). Staff without data get a default build.
- The team name goes on the jersey front; nothing goes on the back yet (numbers are #290).
- 3D assets total at most 3 MB; the 3D chunk at most 300 KB gzipped; three.js never in the entry chunk (`check:bundle --require-3d`).
- On portrait screens the team stands in two rows (spec decision 22).
- Scene colours live in `.ts` files; `.vue` files follow `check:styles`.

## Review Focus

1. **A roster with fewer than five starters, or no coach or GM**, must show just the people it has, centred, never an empty slot or a crash (Task 5 test).
2. **A jersey image that fails to load or blocks cross-origin reads** must give the neutral home kit, not a blank or black uniform (Task 4 test).
3. **Extreme bodies** (a 7'6" centre at 330 lb, a 5'9" guard at 160 lb) must stay upright, on the floor and in frame in the team-photo preset (Task 3 and Task 5 tests).
4. **Switching teams or toggling 3D** must dispose every character's geometry, material and kit texture (Task 5 memory test).
5. **Long names** in chips must truncate, not overflow the viewport on a phone (Task 6 test).

---

### Task 1: The body asset and its notices

**Files:**
- Create: `apps/web/scripts/build-3d-assets.mjs`
- Create: `apps/web/src/three/assets/athletic-male.glb` (generated, committed)
- Create: `THIRD_PARTY_NOTICES.md` (repo root)
- Test: `apps/web/tests/three/assets.test.ts`

**Interfaces:**
- Produces: `apps/web/src/three/assets/athletic-male.glb`, imported later with `?url`.

`build-3d-assets.mjs <source-dir>`: `<source-dir>` is the unzipped Quaternius "Universal Base Characters [Standard]" pack. It copies the textures the glTF names into place (the pack's file names differ: `X_png.png` → `X.png`), then runs `pnpm dlx @gltf-transform/cli@4.5.1 optimize "<source>/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf" src/three/assets/athletic-male.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --join false --flatten false --instance false`. No new dependencies. The script prints the output size.

`THIRD_PARTY_NOTICES.md`: three.js (MIT), meshoptimizer decoder (MIT, ships inside three's addons), Quaternius Universal Base Characters (CC0 1.0), each with its URL.

- [ ] **Step 1: Write the failing test** `tests/three/assets.test.ts`: `the body asset is a GLB within budget` reads the file with `node:fs`, expects the first 4 bytes to be `glTF` and the size to be under 600 KB.
- [ ] **Step 2: Run it.** `pnpm --filter web exec vitest run tests/three/assets.test.ts`. Expected: FAIL (no file).
- [ ] **Step 3: Write the script, download the pack** (itch.io, free tier), **run it**, and write the notices.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): add the CC0 body asset for the 3D figurines`

---

### Task 2: Loading and cloning characters

**Files:**
- Create: `apps/web/src/three/character/load.ts`
- Test: `apps/web/tests/three/characterLoad.test.ts`

**Interfaces:**
- Produces: `dequantizeSkinned(root: Object3D): void`; `loadBody(url: string): Promise<Object3D>` (GLTFLoader with `MeshoptDecoder`, cached per URL, dequantized once); `cloneCharacter(source: Object3D): Object3D` (`SkeletonUtils.clone`, plus per-mesh `geometry.clone()`, `material.clone()`, `frustumCulled = false`, and a copy of each skeleton's `boneInverses`).

Why both exist (from the spike): gltf-transform's meshopt step quantizes positions and hides the scale in the inverse bind matrices, which any `calculateInverses()` drops; and `Skeleton.clone()` shares its `boneInverses` array, which `calculateInverses()` empties in place.

- [ ] **Step 1: Write the failing tests** with a synthetic `SkinnedMesh` (two bones; positions stored at 1/100 scale; inverse bind matrices carrying a ×100 scale):
  - `dequantizeSkinned bakes the hidden scale into positions`: after it, a vertex reads its world rest position, and each `boneInverse` equals the inverse of its bone's `matrixWorld`.
  - `dequantizeSkinned keeps normals unit length`.
  - `clones don't share inverse bind matrices`: clone twice, call `calculateInverses()` on the first clone's skeleton after moving a bone; the second clone's and the source's inverses are unchanged.
  - `clones don't share geometry`: editing one clone's position attribute leaves the other's alone.
- [ ] **Step 2: Run them.** `pnpm --filter web exec vitest run tests/three/characterLoad.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `load.ts`.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): load and clone 3D characters safely`

---

### Task 3: Bodies from height and weight

**Files:**
- Create: `apps/web/src/three/character/reshape.ts` (port of the spike's `reshape.ts`)
- Create: `apps/web/src/three/character/body.ts`
- Test: `apps/web/tests/three/reshape.test.ts`, `apps/web/tests/three/body.test.ts`

**Interfaces:**
- Produces:
  - `reshapeBody(root: Object3D, shape: { girth: number; shoulders: number; wingspan: number }): void`.
  - `type Role = 'player' | 'coach' | 'gm'`; `interface BodySize { heightInches: number; weightPounds: number }`; `POSITION_MEDIANS: Record<'PG'|'SG'|'SF'|'PF'|'C', BodySize>` = PG 74/190, SG 77/205, SF 79/220, PF 81/235, C 83/255; `STAFF_DEFAULT: BodySize` = 72/200; `bodySize(input: { role: Role; position?: string; heightInches: number | null; weightPounds: number | null }): BodySize` (an unknown position uses SF); `girthFor(size: BodySize): number` = clamp(1 + (BMI − 25) × 0.035, 0.86, 1.3), BMI = 703 × lb / in².
  - `snapshotSize(player: PlayerSnapshot): { heightInches: number | null; weightPounds: number | null }`: reads `height_feet`/`height_inches`/`weight_pounds` or the custom `heightFeet`/`heightInches`/`weightPounds`.

- [ ] **Step 1: Write the failing tests.**

`body.test.ts`:
- `real snake_case and custom camelCase sizes both read`: `{height_feet: 6, height_inches: 9, weight_pounds: 250}` and `{heightFeet: 6, heightInches: 9, weightPounds: 250}` both give `{81, 250}`.
- `missing size uses the position median`: a C with nulls gives 83/255.
- `a missing half uses the median for that half only`.
- `staff without data get the default build`.
- `girth stays within its clamp for extreme bodies`: 90 in / 330 lb and 69 in / 160 lb both land within [0.86, 1.3].

`reshape.test.ts` (synthetic chain: `spine_03` → `clavicle_l` → `upperarm_l` → `lowerarm_l` → `hand_l`, with a one-vertex skinned mesh per bone):
- `wingspan stretches the forearm along the bone`: wingspan 1.1 moves `hand_l`'s world origin 10% further from `lowerarm_l` along the forearm.
- `girth widens across the bone, not along it`.
- `the mesh is undeformed at rest after reshaping`: each vertex's skinned position equals its stored position.
- `bones keep unit scale`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** (`reshape.ts` from the spike, unchanged in method).
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): size 3D bodies from real height and weight`

---

### Task 4: Painted uniforms and suits, coloured from the jersey

**Files:**
- Create: `apps/web/src/three/character/kit.ts` (port of the spike's painted path only, no shell)
- Create: `apps/web/src/three/character/jerseyColours.ts`
- Test: `apps/web/tests/three/jerseyColours.test.ts`, `apps/web/tests/three/kit.test.ts`

**Interfaces:**
- Produces:
  - `interface KitColours { primary: string; secondary: string; trim: string }`; `HOME_KIT: KitColours` = `#f4f4f2` / `#1d2a44` / `#1d2a44`.
  - `sampleJerseyColours(image: ImageData): KitColours | null`: ignores transparent pixels and background connected to the image edge (flood fill from the border for near-white and near-black), buckets the rest (5 bits per channel), primary = biggest bucket, secondary = biggest bucket at least 60 in RGB distance from primary, trim = the one of white/near-black with the better contrast against primary. Null if fewer than 2% of pixels are left.
  - `loadJerseyColours(url: string | undefined): Promise<KitColours>`: draws the image (`crossOrigin = 'anonymous'`) to a canvas at most 128 px wide and samples it; any failure or `null` returns `HOME_KIT`.
  - `kit.ts`: `addRegions(mesh: SkinnedMesh)`, `findLandmarks(mesh: SkinnedMesh): Landmarks`, `kitTexture(kit: { kind: 'player' | 'suit'; teamName: string; trim: string; secondary: string }): CanvasTexture`, `applyKitMaterial(source: MeshStandardMaterial, options: { kind; colours: KitColours; landmarks: Landmarks; vinyl: string; texture: CanvasTexture }): MeshStandardMaterial`. Uses the spike's jersey strap and neckline rules. Suit colours: navy `#1d2a44` jacket, gold `#c9a227` tie (my call; staff outfits arrive with #294).

**Learning checkpoint (owner, about 15 lines):** `sampleJerseyColours`. The tests pin the behaviour; if the owner passes, Claude writes it.

- [ ] **Step 1: Write the failing tests.**

`jerseyColours.test.ts` (synthetic `ImageData`):
- `a teal jersey with gold trim on a white template`: a white border, a teal body and a gold stripe give primary teal and secondary gold.
- `background connected to the edge is ignored, white inside the art is kept`: a white jersey with a red trim on a white background still gives primary white.
- `a transparent image gives null`.
- `loadJerseyColours falls back to the home kit when the image fails` (stub `Image` to fire `onerror`).
- `loadJerseyColours falls back to the home kit when the canvas is tainted` (`getImageData` throws).

`kit.test.ts`:
- `the kit texture has the team name on the front half`: drawn text (spy on `fillText`) includes the uppercased team name at an x within the left half.
- `applyKitMaterial clones the source material and keys its program by kind`: different `customProgramCacheKey()` for player and suit.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): paint 3D uniforms in colours from the team's jersey`

---

### Task 5: People in the team scene

**Files:**
- Create: `apps/web/src/three/character/person.ts`
- Create: `apps/web/src/three/scene/layout.ts`
- Modify: `apps/web/src/three/scene/teamScene.ts`
- Test: `apps/web/tests/three/layout.test.ts`, `apps/web/tests/three/teamScene.test.ts` (extend)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `interface PersonInput { id: string; name: string; role: Role; position?: string; heightInches: number | null; weightPounds: number | null }`.
  - `buildPerson(input: PersonInput, kit: { colours: KitColours; teamName: string }): Promise<{ root: Group; headHeight: number }>`: loads and clones the body, adds regions and the kit material in figurine vinyl `#c8c3ba`, hides eyes and brows, reshapes, turns to face +z, applies the spike's relaxed-arms pose, and scales to `heightInches × 0.0254` metres.
  - `layoutPeople(count: number, portrait: boolean): { x: number; z: number }[]`: one row 1.35 m apart (staggered 0.35 m back on odd places) when landscape or when the count is 4 or fewer; otherwise two rows, the first 4 at z 0.9 and the rest at z −0.7. Centred on x = 0.
  - `TeamScene.setPeople(people: PersonInput[], kit: { colours: KitColours; teamName: string }): Promise<void>`: builds all, disposes the previous group, adds a blob shadow under each. A newer call wins; an older one's result is disposed, not added.
  - `TeamScene.labelAnchors(): { id: string; x: number; y: number; visible: boolean }[]`: each person's head (`headHeight + 0.25 m`) projected to the container's pixel space, `visible` false when behind the camera or outside it. Updated every render, before `onRender` fires.
- [ ] **Step 1: Write the failing tests.**

`layout.test.ts`:
- `seven landscape in one centred row`: x from −4.05 to 4.05.
- `seven portrait in two rows of 4 and 3`.
- `three portrait stay in one row`.
- `zero people is an empty layout`.

`teamScene.test.ts` (fake renderer as already there; mock `buildPerson` to return a small `Group` with a `Mesh`):
- `setPeople adds one person and one shadow per input`.
- `a newer setPeople wins and the older one's people are disposed`.
- `labelAnchors projects heads into the container`: after `setPeople`, every anchor of a person in front of the camera is `visible` with `x` within `[0, width]`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): stand the team's people in the 3D scene`

---

### Task 6: Wiring, chips, and verification

**Files:**
- Modify: `apps/web/src/components/scene3d/TeamScene3D.vue` (props `people: PersonInput[]`, `jerseyUrl?: string`, `teamName: string`; chips)
- Modify: `apps/web/src/views/PublicTeam.vue` (build `people`)
- Modify: `apps/web/tests/visual/routes.spec.ts`
- Test: `apps/web/tests/components/TeamScene3D.test.ts`, `apps/web/tests/views/PublicTeam3d.test.ts` (extend)

Behaviour:
- `PublicTeam.vue` builds `people`: starters in slot order (`player-<slot>`, name `fullName`, role `player`, `position`, sizes from `snapshotSize`), then the coach (`coach`) and GM (`gm`) when present, with null sizes.
- `TeamScene3D.vue` calls `loadJerseyColours(jerseyUrl)` once per URL, then `scene.setPeople(people, { colours, teamName })` whenever `people` or the colours change.
- Name chips: one absolutely positioned pill per visible anchor, `translate(-50%, -100%)` at the anchor, text "Name · POS" (players) or "Name · Coach/GM", `max-w-[9rem] truncate`, `pointer-events-none`, `aria-hidden` (the canvas's `aria-label` lists the people: "3D view of {title}: {names}"). Positions update in `onRender`.
- [ ] **Step 1: Write the failing tests.**
  - `TeamScene3D`: `passes people and the sampled kit to the scene`; `renders a chip per visible anchor and none for hidden ones`; `long names truncate` (chip has the `truncate` class and a `max-w` class).
  - `PublicTeam3d`: `builds people from starters, coach and GM in order`; `a roster with two starters and no staff gives two people`.
  - `routes.spec.ts` (3D block): `renders the team without errors` waits for 7 chips with the fixture (5 starters, coach, GM); the steady-memory toggle test keeps passing with people in the scene.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the full gate.** `pnpm --filter web lint && pnpm --filter web type-check && pnpm --filter web check:styles && pnpm --filter web test && pnpm --filter web build && pnpm --filter web check:bundle --require-3d && pnpm --filter web test:visual`. Expected: all pass; 3D chunk ≤ 300 KB gzipped.
- [ ] **Step 5: Emulated gate** on a local production build (412×915, CPU 4× slower, Fast 4G, hardware GPU, plus Firefox): open 3D from a loaded team page within 4 s, p95 frame time ≤ 33 ms while orbiting, no console errors, all seven in frame at 412 px.
- [ ] **Step 6: Commit** `feat(web): show the team's people in the 3D view`, open the PR (`Closes #287`), run `/code-review` before merging.
