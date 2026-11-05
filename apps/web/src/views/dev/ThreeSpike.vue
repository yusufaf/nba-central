<script setup lang="ts">
// Throwaway spike for #119 (3D builders, Phase 0). Dev and PR previews only.
// It answers the gate's questions: does a code-only uniform look right, can a
// phone hold seven people in an arena, how big is the download and the card.
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { CanvasTexture } from 'three';
import { toCanvas } from 'html-to-image';
import PageShell from '@/layouts/PageShell.vue';
import CourtFloor from '@/components/court/CourtFloor.vue';
import { Button } from '@/components/ui/button';
import { SpikeScene, type CameraPreset, type FrameStats, type OrbitResult } from '@/three/spike/scene';
import { preload, type CharacterSpec, type Frame, type HairStyle } from '@/three/spike/character';
import type { KitMode } from '@/three/spike/kit';
import type { Lighting, SeatPattern } from '@/three/spike/arena';
import {
    HAIR_COLOURS,
    SAMPLE_COURT,
    SAMPLE_VENUE,
    SKIN_TINTS,
    TEAM,
    VINYL,
    playerKit,
    suitKit,
    teamSpecs,
} from '@/three/spike/fixtures';

const viewport = ref<HTMLElement | null>(null);
const courtHost = ref<HTMLElement | null>(null);
const scene = shallowRef<SpikeScene | null>(null);

const mode = ref<'team' | 'creator'>('team');
const kitMode = ref<KitMode>('painted');
const lighting = ref<Lighting>('broadcast');
const pattern = ref<SeatPattern>('sections');
const upperDeck = ref(true);
const skinIndex = ref(1);

const frame = ref<Frame>('male');
const heightInches = ref(78);
const weightPounds = ref(215);
const shoulders = ref(1);
const wingspan = ref(1.03);
const hair = ref<HairStyle>('parted');
const beard = ref(false);
const figurine = ref(false);
const suit = ref(false);
const name = ref('Vance');
const number = ref('23');

const stats = ref<FrameStats | null>(null);
const people = ref(0);
const status = ref('Loading models…');
const firstFrame = ref<number | null>(null);
const orbit = ref<OrbitResult | null>(null);
const card = ref<{ png: number; jpeg: number; url: string } | null>(null);
const busy = ref(false);
const loadStartedAt = performance.now();

let courtTexture: CanvasTexture | null = null;

const rasteriseCourt = async () => {
    const node = courtHost.value?.firstElementChild as HTMLElement | null;
    if (!node) return null;
    try {
        const canvas = await toCanvas(node, { pixelRatio: 2, cacheBust: true });
        return new CanvasTexture(canvas);
    } catch (error) {
        console.warn('[3d-spike] court rasterise failed', error);
        return null;
    }
};

const creatorSpec = (): CharacterSpec => ({
    frame: frame.value,
    heightInches: heightInches.value,
    weightPounds: weightPounds.value,
    shoulders: shoulders.value,
    wingspan: wingspan.value,
    hair: hair.value,
    beard: beard.value,
    hairColour: HAIR_COLOURS[1],
    skinTint: SKIN_TINTS[skinIndex.value],
    vinyl: figurine.value ? VINYL : null,
    kit: suit.value ? suitKit(TEAM[5].staff!.primary, TEAM[5].staff!.secondary) : playerKit(name.value, number.value),
    kitMode: kitMode.value,
});

const venue = () => ({ ...SAMPLE_VENUE, lighting: lighting.value, pattern: pattern.value, upperDeck: upperDeck.value });

let rebuildToken = 0;
const rebuildPeople = async () => {
    const current = scene.value;
    if (!current) return;
    const token = ++rebuildToken;
    status.value = 'Building…';
    const specs = mode.value === 'team' ? teamSpecs(kitMode.value, skinIndex.value) : [creatorSpec()];
    const triangles = await current.setPeople(specs);
    if (token !== rebuildToken) return;
    people.value = triangles;
    status.value = '';
    if (firstFrame.value === null) {
        requestAnimationFrame(() => {
            firstFrame.value = Math.round(performance.now());
        });
    }
};

const rebuildArena = () => scene.value?.setArena(venue(), courtTexture);

const setPreset = (preset: CameraPreset) => scene.value?.setPreset(preset);

const runOrbit = async () => {
    if (!scene.value || busy.value) return;
    busy.value = true;
    orbit.value = await scene.value.orbitTest(10);
    busy.value = false;
};

const runCard = async () => {
    if (!scene.value || busy.value) return;
    busy.value = true;
    const { png, jpeg } = await scene.value.cardFrame();
    if (card.value) URL.revokeObjectURL(card.value.url);
    card.value = { png: png.size, jpeg: jpeg.size, url: URL.createObjectURL(jpeg) };
    busy.value = false;
};

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

onMounted(async () => {
    if (!viewport.value) return;
    const created = new SpikeScene(viewport.value);
    created.onRender = (s) => (stats.value = s);
    scene.value = created;
    courtTexture = await rasteriseCourt();
    rebuildArena();
    await preload();
    await rebuildPeople();
});

onBeforeUnmount(() => {
    scene.value?.dispose();
    if (card.value) URL.revokeObjectURL(card.value.url);
});

watch([mode], () => {
    setPreset(mode.value === 'team' ? 'team' : 'creator');
    void rebuildPeople();
});
watch([kitMode, skinIndex], () => void rebuildPeople());
watch([frame, heightInches, weightPounds, shoulders, wingspan, hair, beard, figurine, suit, name, number], () => {
    if (mode.value === 'creator') void rebuildPeople();
});
watch([lighting, pattern, upperDeck], rebuildArena);
</script>

<template>
    <PageShell>
        <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h1 class="text-[1.5rem] font-bold">3D spike</h1>
                <p class="text-sm text-foreground/60">Throwaway (#119). Not part of the app.</p>
            </div>

            <div class="relative h-[60vh] min-h-[22rem] overflow-hidden rounded-xl border border-border bg-card">
                <div ref="viewport" class="absolute inset-0" />
                <div
                    class="pointer-events-none absolute left-2 top-2 rounded-md bg-background/80 px-2 py-1 font-mono text-xs tabular-nums"
                >
                    <div>calls {{ stats?.calls ?? '–' }} · tris {{ stats?.triangles ?? '–' }}</div>
                    <div>people tris {{ Math.round(people) }} · tex {{ stats?.textures ?? '–' }}</div>
                    <div>first frame {{ firstFrame ?? '–' }} ms after load</div>
                    <div v-if="orbit">
                        orbit p50 {{ orbit.p50.toFixed(1) }} · p95 {{ orbit.p95.toFixed(1) }} · max
                        {{ orbit.max.toFixed(0) }} ms @ {{ orbit.pixelRatio }}x
                    </div>
                    <div v-if="card">card png {{ kb(card.png) }} · jpeg {{ kb(card.jpeg) }}</div>
                    <div v-if="status">{{ status }}</div>
                </div>
            </div>

            <div class="flex flex-wrap gap-2">
                <Button
                    v-for="preset in ['team', 'courtside', 'broadcast', 'rafters', 'creator'] as const"
                    :key="preset"
                    size="sm"
                    variant="outline"
                    @click="setPreset(preset)"
                >
                    {{ preset }}
                </Button>
                <Button size="sm" :disabled="busy" @click="runOrbit">Orbit test (10 s)</Button>
                <Button size="sm" variant="secondary" :disabled="busy" @click="runCard">Card frame</Button>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <fieldset class="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                    <legend class="px-1 text-xs font-bold uppercase tracking-[0.06em]">Scene</legend>
                    <label class="flex items-center justify-between gap-2">
                        Mode
                        <select v-model="mode" class="rounded border border-input bg-background px-2 py-1">
                            <option value="team">Team (7 people)</option>
                            <option value="creator">Creator (1 person)</option>
                        </select>
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Uniform
                        <select v-model="kitMode" class="rounded border border-input bg-background px-2 py-1">
                            <option value="painted">Painted on</option>
                            <option value="shell">Shell</option>
                            <option value="none">None</option>
                        </select>
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Skin tint
                        <input v-model.number="skinIndex" type="range" min="0" :max="SKIN_TINTS.length - 1" step="1" />
                    </label>
                </fieldset>

                <fieldset class="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                    <legend class="px-1 text-xs font-bold uppercase tracking-[0.06em]">Arena</legend>
                    <label class="flex items-center justify-between gap-2">
                        Lighting
                        <select v-model="lighting" class="rounded border border-input bg-background px-2 py-1">
                            <option value="broadcast">Broadcast</option>
                            <option value="theater">Theater</option>
                        </select>
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Seats
                        <select v-model="pattern" class="rounded border border-input bg-background px-2 py-1">
                            <option value="solid">Solid</option>
                            <option value="sections">Sections</option>
                            <option value="rows">Rows</option>
                            <option value="gradient">Gradient</option>
                        </select>
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Upper deck
                        <input v-model="upperDeck" type="checkbox" />
                    </label>
                </fieldset>

                <fieldset
                    class="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
                    :disabled="mode !== 'creator'"
                >
                    <legend class="px-1 text-xs font-bold uppercase tracking-[0.06em]">Creator</legend>
                    <label class="flex items-center justify-between gap-2">
                        Frame
                        <select v-model="frame" class="rounded border border-input bg-background px-2 py-1">
                            <option value="male">Athletic M</option>
                            <option value="female">Athletic F</option>
                        </select>
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Height {{ Math.floor(heightInches / 12) }}'{{ heightInches % 12 }}"
                        <input v-model.number="heightInches" type="range" min="66" max="90" step="1" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Weight {{ weightPounds }} lb
                        <input v-model.number="weightPounds" type="range" min="140" max="320" step="5" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Shoulders {{ shoulders.toFixed(2) }}
                        <input v-model.number="shoulders" type="range" min="0.85" max="1.25" step="0.01" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Wingspan {{ wingspan.toFixed(2) }}
                        <input v-model.number="wingspan" type="range" min="0.9" max="1.15" step="0.01" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Hair
                        <select v-model="hair" class="rounded border border-input bg-background px-2 py-1">
                            <option value="none">None</option>
                            <option value="buzzed">Buzzed</option>
                            <option value="buzzedFemale">Buzzed (F)</option>
                            <option value="parted">Parted</option>
                            <option value="long">Long</option>
                            <option value="buns">Buns</option>
                        </select>
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Beard <input v-model="beard" type="checkbox" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Figurine (real person) <input v-model="figurine" type="checkbox" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Suit (coach/GM) <input v-model="suit" type="checkbox" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Name
                        <input v-model="name" maxlength="14" class="w-32 rounded border border-input bg-background px-2 py-1" />
                    </label>
                    <label class="flex items-center justify-between gap-2">
                        Number
                        <input v-model="number" maxlength="2" class="w-16 rounded border border-input bg-background px-2 py-1" />
                    </label>
                </fieldset>
            </div>

            <img v-if="card" :src="card.url" alt="3D card frame (JPEG)" class="w-full max-w-[40rem] rounded-lg border border-border" />
            <p class="text-xs text-foreground/50">Load started at {{ Math.round(loadStartedAt) }} ms.</p>
        </div>

        <!-- The 2D court, rasterised once into the 3D floor texture. Off-screen,
             not hidden: html-to-image needs it laid out. -->
        <div ref="courtHost" class="pointer-events-none fixed -left-[200rem] top-0 w-[65rem]" aria-hidden="true">
            <CourtFloor :court="SAMPLE_COURT" decorative />
        </div>
    </PageShell>
</template>
