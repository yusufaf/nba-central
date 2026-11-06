# 3D Team Scene Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A published team's page at `?view=3d` shows a live 3D arena (the team's court inside a seating bowl, camera presets), loaded lazily, with a 2D fallback. Issue #286.

**Architecture:** Framework-free three.js modules under `apps/web/src/three/` (renderer, arena, scene) build the scene; one lazy Vue component (`src/components/scene3d/`) hosts it and its HUD; `PublicTeam.vue` mounts that component only when `?view=3d` is set. Lint rules and a post-build check keep three.js out of the entry chunk.

**Tech Stack:** three 0.187.0 (plain, no TresJS), Vue 3.5, html-to-image (already a dependency), Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-3d-builders-design.md`.

**Scope:** #286 is the first slice of the spec's Phase 1. The rest of Phase 1 is tracked elsewhere and not in this plan: people, the asset script, `THIRD_PARTY_NOTICES.md` and sampled uniform colours are in #287, and the builder's entry point is in #288. Spike to learn from (throwaway, never copy wholesale): branch `feat/3d-spike`, `apps/web/src/three/spike/` (PR #284).

## Global Constraints

- `three@0.187.0` and `@types/three@0.187.0`, exact versions, in `apps/web`.
- `three` and `three/*` are imported only under `src/three/**`; `@/three/*` only under `src/three/**` and `src/components/scene3d/**`.
- The entry chunk never contains `WebGLRenderer`; the chunk that does is at most 300 KB gzipped.
- Pixel ratio is `Math.min(devicePixelRatio, 1.5)`. Frames render on demand only.
- One shared `WebGLRenderer` for the whole app.
- The 2D page stays exactly as it is; 3D is added, never substituted.
- `check:styles` rules apply to new `.vue` files: no raw hex, `rem` not `px`, no arbitrary z-index. Scene colours live in `.ts` files.
- Conventional Commits, `feat(web): …` for features, `ci: …` for the workflow change.

## Review Focus

1. **Navigating `/t/A?view=3d` to `/t/B?view=3d`** reuses the `PublicTeam` instance: the scene must show B's court, with A's resources disposed (Task 5 test).
2. **Toggling 3D on and off repeatedly** must not grow GPU memory or create new WebGL contexts (Task 1 disposal test, Task 5 toggle test).
3. **A court logo that blocks cross-origin reads** must give the court without its logo, never a blank floor or an exception (Task 4 test).
4. **No court:** a team with no arena, a built-in arena, or `arena.missing` gets the neutral default court (Task 4 test).
5. **WebGL context lost** (a phone backgrounding the tab) shows "3D view paused" and recovers on restore, with no error loop (Task 5 test).

---

### Task 1: Shared renderer, WebGL detection, disposal, and the bundle guards

**Files:**
- Modify: `apps/web/package.json` (add `three`, `@types/three`, script `check:bundle`)
- Create: `apps/web/src/utils/webgl.ts`
- Create: `apps/web/src/three/renderer/shared.ts`
- Create: `apps/web/scripts/check-bundle.mjs`
- Modify: `apps/web/eslint.config.mjs` (new block `app/three-boundary`, before `skipFormatting`)
- Modify: `.github/workflows/ci.yml` (web job: `pnpm --filter web check:bundle` right after `build`)
- Test: `apps/web/tests/three/shared.test.ts`, `apps/web/tests/utils/webgl.test.ts`

**Interfaces:**
- Produces:
  - `isWebGLAvailable(): boolean` in `src/utils/webgl.ts`. Imports nothing from three; safe in the entry chunk.
  - `SCENE_CHUNK_MARKER = 'nba-central-3d-chunk'` in `src/three/renderer/shared.ts`. `getSharedRenderer` writes it to `renderer.domElement.dataset.chunk`, so the literal survives minification and marks the 3D chunk for `check:bundle`.
  - `MAX_PIXEL_RATIO = 1.5`, `getSharedRenderer(): WebGLRenderer`, `onContextChange(listener: (lost: boolean) => void): () => void` (returns an unsubscribe), `disposeObject(root: Object3D): void` in `src/three/renderer/shared.ts`.

- [ ] **Step 1: Write the failing tests**

`tests/three/shared.test.ts`:
- `disposeObject disposes every geometry, material and texture under the root once`: build a `Group` holding two `Mesh`es that share one geometry, one with a `MeshStandardMaterial` whose `map` is a `Texture`, one with an array of two materials; spy on each `dispose`; call `disposeObject(group)`; expect each geometry, material and texture `dispose` called exactly once.
- `disposeObject ignores non-mesh nodes`: a `Group` with an `Object3D` child doesn't throw.

`tests/utils/webgl.test.ts`:
- `returns false when getContext returns null` (jsdom default): `expect(isWebGLAvailable()).toBe(false)`.
- `returns true when webgl2 is available`: stub `HTMLCanvasElement.prototype.getContext` to return `{}` for `'webgl2'`; expect `true`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter web exec vitest run tests/three/shared.test.ts tests/utils/webgl.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Add the dependencies**

Run: `pnpm --filter web add three@0.187.0` and `pnpm --filter web add -D @types/three@0.187.0`.

- [ ] **Step 4: Implement `isWebGLAvailable` and `shared.ts`**

`getSharedRenderer` creates the renderer once (`antialias: true`, `powerPreference: 'high-performance'`), sets the capped pixel ratio, and listens for `webglcontextlost` (call `event.preventDefault()`, then notify listeners with `true`) and `webglcontextrestored` (notify `false`). `disposeObject` dedupes by identity with a `Set` so shared geometries and materials are disposed once, and disposes every `Texture`-valued property of each material.

- [ ] **Step 5: Run the tests to verify they pass**

Run: same as step 2. Expected: PASS.

- [ ] **Step 6: Add the lint boundary**

Two flat-config blocks. In flat config a later block's `no-restricted-imports` **replaces** an earlier one for the same file, so each block lists its full pattern set and the two blocks' `files` never overlap:
- `app/three-boundary`: `files: ['src/**/*.{ts,vue}']`, `ignores: ['src/three/**', 'src/components/scene3d/**']`, banning `three`, `three/*` and `@/three/*` ("3D code stays behind the lazy scene3d component").
- `app/three-boundary-scene3d`: `files: ['src/components/scene3d/**']`, banning `three` and `three/*` ("go through @/three modules").

Prove both bans fire: temporarily add `import 'three'` to `src/views/Home.vue` and to a scene3d file; `pnpm --filter web lint` must report one error each; then remove them.

Run: `pnpm --filter web lint`. Expected: 0 errors.

- [ ] **Step 7: Write `scripts/check-bundle.mjs`**

Reads `dist/index.html`, collects every `<script type="module" src>` and `<link rel="modulepreload" href>`, and fails (exit 1, naming the file) if any contains the `SCENE_CHUNK_MARKER` string or `WebGLRenderer`. Then finds the `dist/assets/*.js` chunk containing the marker, gzips it with `node:zlib`, prints its size, and fails above 300 × 1024 bytes. With `--require-3d`, finding no such chunk is a failure; without it, that is a pass, which only Tasks 1 to 4 need. Add `"check:bundle": "node scripts/check-bundle.mjs"`.

Run: `pnpm --filter web build && pnpm --filter web check:bundle`. Expected: passes and reports no 3D chunk.

- [ ] **Step 8: Wire it into CI** (one line after the web job's `build` step), then commit

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/utils/webgl.ts apps/web/src/three apps/web/scripts/check-bundle.mjs apps/web/eslint.config.mjs apps/web/tests/three apps/web/tests/utils/webgl.test.ts .github/workflows/ci.yml
git commit -m "feat(web): add the shared 3D renderer and keep three.js out of the entry chunk"
```

---

### Task 2: Camera presets and framing

**Files:**
- Create: `apps/web/src/three/scene/cameraPresets.ts`
- Test: `apps/web/tests/three/cameraPresets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type CameraPreset = 'team' | 'courtside' | 'broadcast' | 'rafters'`; `CAMERA_PRESETS: readonly CameraPreset[]` in that order; `PRESET_LABELS: Record<CameraPreset, string>` = Team photo, Courtside, Broadcast, Rafters; `ORBIT_LIMITS = { minDistance: 1.5, maxDistance: 45, maxPolarAngle: Math.PI * 0.49 }`; `MAX_FRAMING_DISTANCE = 10.5`; `framePreset(preset: CameraPreset, aspect: number): { position: [number, number, number]; target: [number, number, number]; fov: number }`.

Base values (from the spike): team `(0, 1.5, 9.5)` → `(0, 1.1, 0)`; courtside `(7.5, 1.2, 6)` → `(0, 1.2, 0)`; broadcast `(0, 10, 24)` → `(0, 1, 0)`; rafters `(0.01, 30, 6)` → `(0, 0, 0)`. `fov` is 40, or 50 when `aspect < 1`. Only `team` is framed: keep the base direction from the target, and set the distance to `1.08 × max(halfWidth / tan(hfov/2), halfHeight / tan(vfov/2))` with `halfWidth 4.9, halfHeight 1.3` (landscape) or `2.7, 1.5` (portrait), capped at `MAX_FRAMING_DISTANCE` so the camera never enters the stands.

- [ ] **Step 1: Write the failing tests**

- `team at 16:9 uses the fit formula`: distance from target within 0.01 of `1.08 × max(4.9 / tan(hfov/2), 1.3 / tan(20°))`; `fov` 40.
- `team in portrait widens the lens and fits the whole row`: at aspect 0.625 (the narrowest the viewport allows, see Task 4) `fov` is 50, the distance is below `MAX_FRAMING_DISTANCE`, and the visible half-width at the target, `distance × tan(hfov/2)`, is at least 2.7.
- `narrower than the viewport allows is capped, not pushed into the stands`: aspect 0.46 gives a distance of exactly `MAX_FRAMING_DISTANCE`.
- `fixed presets ignore aspect`: courtside at aspects 0.5 and 2 has the same position and target.
- `every preset has a label`: `CAMERA_PRESETS.every((p) => PRESET_LABELS[p])`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter web exec vitest run tests/three/cameraPresets.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `cameraPresets.ts`**, pure maths, no three import needed.

- [ ] **Step 4: Run them to verify they pass.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(web): add camera presets for the 3D team scene`

---

### Task 3: The arena: court floor, seating bowl, lighting

**Files:**
- Create: `apps/web/src/three/arena/court.ts`
- Create: `apps/web/src/three/arena/bowl.ts`
- Create: `apps/web/src/three/arena/lighting.ts`
- Create: `apps/web/src/three/arena/palette.ts` (scene colours as hex)
- Test: `apps/web/tests/three/bowl.test.ts`, `apps/web/tests/three/court.test.ts`

**Interfaces:**
- Produces:
  - `court.ts`: `COURT_LENGTH_M = 104 * 0.3048`, `COURT_DEPTH_M = 58 * 0.3048`; `courtTexture(canvas: HTMLCanvasElement, renderer: WebGLRenderer): CanvasTexture` (sRGB, max anisotropy); `buildCourt(texture: Texture | null): Group` (the floor plane plus a dark surround reaching the bowl).
  - `bowl.ts`: `interface Deck { rows: number; startOffset: number; startHeight: number; tread: number; rise: number }`; `DEFAULT_CAPACITY = 18000`; `bowlLayout(capacity: number | null): Deck[]`; `buildBowl(decks: Deck[], seat: string): Mesh` (treads and risers as one vertex-coloured mesh around a rounded rectangle 2.5 m outside the court, 96 segments, as in the spike's `buildDeck`).
  - `lighting.ts`: `broadcastLighting(): Group` (hemisphere 1.6 plus a key directional 2.2 at `(4, 20, 12)`).

**Learning checkpoint (owner writes `bowlLayout`, about 15 lines).** Rules: `capacity ?? DEFAULT_CAPACITY`. Lower deck: `rows = clamp(round(capacity / 1000), 12, 24)`, `startOffset 1`, `startHeight 0`, `tread 0.85`, `rise 0.42`. Upper deck only when capacity > 12000: `rows = clamp(round((capacity - 12000) / 600), 6, 16)`, `tread 0.8`, `rise 0.56`, `startOffset = lower.startOffset + lower.rows × lower.tread + 1.5`, `startHeight = lower.startHeight + lower.rows × lower.rise + 2.4`.

- [ ] **Step 1: Write the failing tests**

`bowl.test.ts`:
- `null capacity uses the default`: `bowlLayout(null)` equals `bowlLayout(18000)`: lower 18 rows, upper 10 rows.
- `small arenas have one deck`: `bowlLayout(5000)` is one deck of 12 rows.
- `huge arenas clamp`: `bowlLayout(30000)` gives 24 and 16 rows.
- `the upper deck starts above and behind the lower`: its `startHeight` exceeds the lower deck's top (`startHeight + rows × rise`), and its `startOffset` exceeds the lower deck's outer edge.
- `buildBowl stays in budget`: `buildBowl(bowlLayout(30000), '#0f5257')` has at most 40,000 triangles (position count / 3).

`court.test.ts`:
- `buildCourt sizes the floor to the SVG court`: the floor's geometry bounding box is `COURT_LENGTH_M` by `COURT_DEPTH_M`.
- `buildCourt without a texture still builds`: `buildCourt(null)` has a floor whose material has no `map`.

- [ ] **Step 2: Run them to verify they fail.** `pnpm --filter web exec vitest run tests/three/bowl.test.ts tests/three/court.test.ts`. Expected: FAIL.

- [ ] **Step 3: Owner writes `bowlLayout`; implement the rest.** `palette.ts` holds the seat, surround, background and fog colours (spike values: seat `#2a3140`, surround `#1a1d22`, background and fog `#0b0d11`, fog 40 to 90 m).

- [ ] **Step 4: Run them to verify they pass.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(web): add the 3D arena's court floor, bowl and lighting`

---

### Task 4: The team scene and its Vue component

**Files:**
- Create: `apps/web/src/three/scene/teamScene.ts`
- Create: `apps/web/src/three/arena/rasteriseCourt.ts`
- Create: `apps/web/src/components/scene3d/TeamScene3D.vue`
- Create: `apps/web/src/components/scene3d/Scene3DUnavailable.vue`
- Create: `apps/web/src/components/scene3d/index.ts`
- Modify: `apps/web/src/lib/analytics.ts` (add `scene3d_preset` and `scene3d_view_clicked` to `ACTION_EVENTS`; `scene3d_opened` and `scene3d_failed` stay passive, since a shared `?view=3d` link opens the scene without any action)
- Test: `apps/web/tests/components/TeamScene3D.test.ts`, `apps/web/tests/three/rasteriseCourt.test.ts`

**Interfaces:**
- Consumes: Task 1 `getSharedRenderer`, `onContextChange`, `disposeObject`; Task 2 `framePreset`, `ORBIT_LIMITS`, `CAMERA_PRESETS`, `PRESET_LABELS`; Task 3 `buildCourt`, `courtTexture`, `bowlLayout`, `buildBowl`, `broadcastLighting`.
- Produces:
  - `rasteriseCourt(node: HTMLElement): Promise<HTMLCanvasElement | null>`: html-to-image `toCanvas(node, { pixelRatio: 2, cacheBust: true })`, then reads one pixel with `getImageData` to prove the canvas isn't tainted. Any throw returns `null`.
  - `class TeamScene { constructor(container: HTMLElement); setArena(court: HTMLCanvasElement | null, capacity: number | null): void; setPreset(preset: CameraPreset): void; readonly renderCount: number; onRender: (() => void) | null; dispose(): void }`. `setArena` disposes the previous arena group before adding the new one. `dispose` removes the canvas from the container but keeps the shared renderer alive.
  - `TeamScene3D.vue` props: `{ court: CourtDesign | null; logoUrl?: string; drawingUrl?: string; capacity: number | null; label: string }`; emits `failed: [reason: 'context-lost']`.
  - `Scene3DUnavailable.vue` props: `{ reason: 'load' | 'no-webgl' }`.
  - `index.ts`: `TeamScene3DAsync`, a `defineAsyncComponent` with `errorComponent: Scene3DUnavailable` and `timeout: 20000`, whose loader catches, calls `track('scene3d_failed', { reason: 'load' })`, and rethrows.

`TeamScene3D.vue` behaviour:
- An off-screen host (fixed, `-left-[200rem]`, `w-[65rem]`, `aria-hidden`) renders `CourtFloor` for `court ?? defaultCourt`. `defaultCourt` is `{ ...newCourt(''), centerLogo: 'none' }`.
- On mount and whenever `court`, `logoUrl`, `drawingUrl` or `capacity` change: rasterise, stepping down on each `null`: all images, then without the logo, then without the drawing too. Only if all three fail does the scene get `null` (the default court). Then `scene.setArena`.
- Every rasterise run takes a token from a counter. Before `setArena` it checks that its token is still the latest and the component isn't unmounted; otherwise it drops its canvas. So a slow run for an old court never lands over a newer one or on a disposed scene.
- The viewport is `h-[min(70vh,40rem,160vw)]`, which keeps its aspect at 0.625 or wider so the portrait team fits, wrapping the canvas in `role="img"` with `:aria-label="label"` and `:data-render-count="renderCount"`.
- The HUD has one `Button` per `CAMERA_PRESETS` entry, using `PRESET_LABELS`, with `aria-pressed` on the active one. A click calls `setPreset` and `track('scene3d_preset', { preset })`. Presets jump; there is no camera tween in this slice.
- Context lost shows "3D view paused" over the canvas, emits `failed('context-lost')` and tracks `scene3d_failed { reason: 'context-lost' }`. Restore hides the message and requests a render.
- Unmount disposes the scene and unsubscribes.

`Scene3DUnavailable.vue`: a short card. For `load`: "The 3D view couldn't load. Everything below is the regular team page." For `no-webgl`: "This browser can't show the 3D view. Everything below is the regular team page." The async component's `errorComponent` is a wrapper rendering it with `reason="load"`.

- [ ] **Step 1: Write the failing tests**

`rasteriseCourt.test.ts` (mock `html-to-image`):
- `returns the canvas when it can be read`.
- `returns null when toCanvas throws`.
- `returns null when the canvas is tainted`: `getImageData` throws a `SecurityError`.

`TeamScene3D.test.ts` (mock `@/three/scene/teamScene` with a fake `TeamScene` recording calls, and mock `rasteriseCourt`):
- `renders one button per preset and marks the active one`.
- `clicking a preset sets it and tracks scene3d_preset`.
- `falls back to the court without its logo when the first rasterise fails`: the first call returns `null` and the second returns a canvas; `setArena` gets the second; `CourtFloor` re-rendered without `logo-url`.
- `falls back to the court without its drawing when the logo wasn't the problem`: the first two calls return `null` and the third returns a canvas; `CourtFloor` has neither `logo-url` nor `drawing-url`; `setArena` gets the canvas.
- `a stale rasterise never lands`: hold the first call's promise; change `court`; resolve the second, then the first; `setArena` was called once, with the second canvas.
- `a rasterise finishing after unmount is dropped`: unmount while the call is pending; resolve it; `setArena` is never called.
- `uses the default court when court is null`: the off-screen `CourtFloor` receives `centerLogo: 'none'`.
- `a context loss shows the paused message and emits failed`: invoke the listener passed to a mocked `onContextChange` with `true`.
- `unmount disposes the scene`.

- [ ] **Step 2: Run them to verify they fail.** `pnpm --filter web exec vitest run tests/components/TeamScene3D.test.ts tests/three/rasteriseCourt.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `rasteriseCourt.ts`, `teamScene.ts`, the two components and `index.ts`.** `TeamScene` uses `OrbitControls` from `three/addons/controls/OrbitControls.js` with `ORBIT_LIMITS`, renders on `change`, and re-frames the active preset on resize (`ResizeObserver`). Scene background and fog come from `palette.ts`.

- [ ] **Step 4: Run them to verify they pass**, then `pnpm --filter web type-check && pnpm --filter web check:styles && pnpm --filter web lint`. Expected: all pass.

- [ ] **Step 5: Commit** `feat(web): add the lazy 3D team scene component`

---

### Task 5: `?view=3d` on the public team page, and the smoke test

**Files:**
- Modify: `apps/web/src/views/PublicTeam.vue`
- Create: `apps/web/tests/visual/stubs.ts` (move `routes.spec.ts`'s network stubbing here as `stubNetwork(page: Page): Promise<void>`; `routes.spec.ts` calls it)
- Create: `apps/web/tests/visual/scene3d.spec.ts`
- Modify: `apps/web/playwright.config.ts` (both projects: `launchOptions: { args: ['--enable-unsafe-swiftshader'] }`)
- Test: `apps/web/tests/views/PublicTeam3d.test.ts`

**Interfaces:**
- Consumes: Task 1 `isWebGLAvailable`; Task 4 `TeamScene3DAsync`.

Behaviour in `PublicTeam.vue`:
- `show3d = computed(() => route.query.view === '3d')`.
- The action row gains a button: "View in 3D" when off, "Hide 3D" when on. It toggles with `router.replace`, keeping the other query params, and tracks `scene3d_view_clicked { on }`.
- When `show3d` is on and the team has loaded, a section above "Starting five" holds `TeamScene3DAsync`, keyed by `teamUUID` so a new team remounts it. Props: `court: arena?.court ?? null`, `logo-url: courtLogoUrl`, `drawing-url: arena?.drawingUrl`, `capacity: arena?.capacity ?? null`, and a label like "3D view of {title}'s court".
- When WebGL isn't available, the section shows `Scene3DUnavailable` with `reason="no-webgl"` instead, and tracks `scene3d_failed { reason: 'no-webgl' }` once.
- `scene3d_opened { page: 'public' }` fires once per team load while `show3d` is on.
- Everything else on the page is untouched.

- [ ] **Step 1: Write the failing tests**

`PublicTeam3d.test.ts` (stub `teamApi.getPublicTeam`, `isWebGLAvailable`, `TeamScene3DAsync`):
- `no scene without ?view=3d`: the stub isn't rendered and the button reads "View in 3D".
- `?view=3d mounts the scene with the arena's court and capacity`.
- `the button toggles the query and keeps other params`: start at `?ref=x`; click; expect `router.replace` called with query `{ ref: 'x', view: '3d' }`.
- `navigating to another team remounts the scene`: change the `teamUUID` prop; the stub's mount count rises and it receives the new team's court.
- `without WebGL it shows the unavailable card and tracks no-webgl once`.
- `tracks scene3d_opened once per team load`.

`scene3d.spec.ts` (Playwright, `stubNetwork`, the `public-team.json` fixture):
- `renders a frame without errors`: go to `/t/visual-team?view=3d`; expect `[role="img"][data-render-count]` to have a count of at least 1 within 15 s; expect no console errors.
- `toggling five times keeps one canvas and steady memory`: click "Hide 3D" and "View in 3D" five times; expect exactly one `canvas` in the page; read `renderer.info.memory` through a test-only `window.__scene3dInfo` set in dev builds only (guard: `import.meta.env.DEV`), and expect geometries and textures equal to the first open's counts.
- `context loss shows paused and recovers`: get `WEBGL_lose_context` from the canvas's context and call `loseContext()`; expect "3D view paused". Call `restoreContext()`; expect it hidden and the render count to grow.

- [ ] **Step 2: Run them to verify they fail.** `pnpm --filter web exec vitest run tests/views/PublicTeam3d.test.ts` (FAIL), and `pnpm --filter web test:visual -- scene3d.spec.ts` (FAIL).

- [ ] **Step 3: Implement the page change, the stub extraction and the config change.** Also change the CI step from Task 1 to `pnpm --filter web check:bundle --require-3d`.

- [ ] **Step 3b: Update the `public-team` baseline on purpose.** The new button changes that full-page screenshot. Run `pnpm --filter web test:visual:update -- routes.spec.ts`, check that the only difference in `public-team.png` (desktop and mobile) is the button, and commit the new images.

- [ ] **Step 4: Run the full gate**

Run: `pnpm --filter web lint && pnpm --filter web type-check && pnpm --filter web check:styles && pnpm --filter web test && pnpm --filter web build && pnpm --filter web check:bundle --require-3d && pnpm --filter web test:visual`
Expected: all pass. `check:bundle --require-3d` finds the 3D chunk and reports it at or below 300 KB gzipped. The only baseline that changed is `public-team`, from Step 3b.

- [ ] **Step 5: Commit** `feat(web): show the 3D team scene at ?view=3d on public team pages`

---

### Task 6: Verify on the PR preview

**Files:** none.

- [ ] **Step 1: Open the PR** (`Closes #286`) and wait for the `preview` check.
- [ ] **Step 2: Run the emulated gate** against `https://yusufaf.dev/nba-central/pr-preview/pr-<N>/#/t/<a published dev team>?view=3d`, using the spike's method: 412x915, CPU 4x slower, Fast-4G network, with a hardware GPU, plus Firefox. Expected: no console errors; the team-photo preset is in frame at 412 px; first frame within 4 s from an already-open team page.
- [ ] **Step 3: Check link previews** after merge and deploy: `curl -s "https://nba.yusufaf.dev/t/<uuid>?view=3d" | grep og:image` returns the team's card, the same as without the query.
- [ ] **Step 4:** Run `/code-review` (medium or higher) before merging.
