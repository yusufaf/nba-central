<script setup lang="ts">
// The team's arena in 3D (#286): the court from its 2D design inside a seating
// bowl, with camera presets. Loaded lazily through ./index.ts; never import it
// directly, or three.js lands in the page's own chunk.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import CourtFloor from '@/components/court/CourtFloor.vue';
import { Button } from '@/components/ui/button';
import Scene3DUnavailable from './Scene3DUnavailable.vue';
import { DEFAULT_COURT, courtAttempts } from './courtRaster';
import { track } from '@/lib/analytics';
import type { CourtDesign } from '@/models/api';
import { rasteriseCourt } from '@/three/arena/rasteriseCourt';
import { loadJerseyColours, type KitColours } from '@/three/character/jerseyColours';
import type { PersonInput } from '@/three/character/person';
import { onContextChange } from '@/three/renderer/shared';
import { CAMERA_PRESETS, PRESET_LABELS, type CameraPreset } from '@/three/scene/cameraPresets';
import { TeamScene, type LabelAnchor } from '@/three/scene/teamScene';

const props = withDefaults(
    defineProps<{
        court: CourtDesign | null;
        logoUrl?: string;
        drawingUrl?: string;
        capacity: number | null;
        label: string;
        people?: PersonInput[];
        jerseyUrl?: string;
        teamName?: string;
    }>(),
    { logoUrl: undefined, drawingUrl: undefined, people: () => [], jerseyUrl: undefined, teamName: '' },
);
const emit = defineEmits<{ failed: [reason: 'context-lost'] }>();

const viewport = ref<HTMLElement | null>(null);
const courtHost = ref<HTMLElement | null>(null);
const scene = shallowRef<TeamScene | null>(null);
const preset = ref<CameraPreset>('team');
const renderCount = ref(0);
const paused = ref(false);
// The page's probe can pass and context creation still fail (a blocklisted
// driver, too many live contexts).
const unavailable = ref(false);
const anchors = ref<LabelAnchor[]>([]);
// On a phone the team stands in two rows and full names collide: surnames only.
const COMPACT_BELOW_PX = 640;
const compact = ref(false);

const ROLE_LABELS = { coach: 'Coach', gm: 'GM' } as const;
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;
// "Jaren Jackson Jr." reads as Jackson, not Jr.
const surname = (name: string) => {
    const words = name.trim().split(/\s+/);
    const last = words.length > 1 && SUFFIX.test(words.at(-1)!) ? words.at(-2) : words.at(-1);
    return last || name;
};
const chips = computed(() => {
    const byId = new Map(props.people.map((person) => [person.id, person]));
    return anchors.value.flatMap((anchor) => {
        const person = byId.get(anchor.id);
        if (!anchor.visible || !person) return [];
        if (compact.value) return [{ ...anchor, text: surname(person.name) }];
        const role = person.role === 'player' ? person.position || '' : ROLE_LABELS[person.role];
        return [{ ...anchor, text: role ? `${person.name} · ${role}` : person.name }];
    });
});

// The team's people, in uniform colours read off its jersey (once per URL).
let kitFor: { url: string | undefined; colours: Promise<KitColours> } | null = null;
const placePeople = async () => {
    const current = scene.value;
    if (!current) return;
    if (!kitFor || kitFor.url !== props.jerseyUrl) kitFor = { url: props.jerseyUrl, colours: loadJerseyColours(props.jerseyUrl) };
    const colours = await kitFor.colours;
    if (scene.value !== current) return;
    // The arena stays up without them; a later prop change tries again.
    try {
        await current.setPeople(props.people, { colours, teamName: props.teamName });
    } catch {
        track('scene3d_failed', { reason: 'people' });
    }
};

// What the off-screen CourtFloor draws. The fallback steps drop images that
// block cross-origin reads.
const rasterCourt = ref<CourtDesign>(props.court ?? DEFAULT_COURT);
const rasterLogo = ref<string | undefined>(props.logoUrl);
const rasterDrawing = ref<string | undefined>(props.drawingUrl);

let latest = 0;
let unmounted = false;

const rasterise = async () => {
    const token = ++latest;
    const current = () => token === latest && !unmounted;
    let canvas: HTMLCanvasElement | null = null;
    for (const attempt of courtAttempts(props.logoUrl, props.drawingUrl)) {
        rasterCourt.value = props.court ?? DEFAULT_COURT;
        rasterLogo.value = attempt.logo;
        rasterDrawing.value = attempt.drawing;
        await nextTick();
        const node = courtHost.value?.firstElementChild as HTMLElement | null;
        canvas = node ? await rasteriseCourt(node) : null;
        if (!current()) return;
        if (canvas) break;
    }
    scene.value?.setArena(canvas, props.capacity);
};

const choose = (next: CameraPreset) => {
    preset.value = next;
    scene.value?.setPreset(next);
    track('scene3d_preset', { preset: next });
};

let stopContext: (() => void) | null = null;

onMounted(() => {
    if (!viewport.value) return;
    let created: TeamScene;
    try {
        created = new TeamScene(viewport.value);
    } catch {
        unavailable.value = true;
        track('scene3d_failed', { reason: 'no-webgl' });
        return;
    }
    created.onRender = () => {
        renderCount.value = created.renderCount;
        compact.value = (viewport.value?.clientWidth || Infinity) < COMPACT_BELOW_PX;
        anchors.value = created.labelAnchors();
    };
    scene.value = created;
    stopContext = onContextChange((lost) => {
        paused.value = lost;
        if (lost) {
            emit('failed', 'context-lost');
            track('scene3d_failed', { reason: 'context-lost' });
        } else {
            scene.value?.requestRender();
        }
    });
    void rasterise();
    void placePeople();
});

watch([() => props.people, () => props.jerseyUrl, () => props.teamName], () => void placePeople());

watch(() => [props.court, props.logoUrl, props.drawingUrl, props.capacity], () => void rasterise());

onBeforeUnmount(() => {
    unmounted = true;
    stopContext?.();
    scene.value?.dispose();
    scene.value = null;
});
</script>

<template>
    <Scene3DUnavailable v-if="unavailable" reason="no-webgl" />
    <div v-else class="flex flex-col gap-3">
        <div class="relative h-[min(70vh,40rem,160vw)] overflow-hidden rounded-xl border border-border bg-card">
            <div ref="viewport" class="absolute inset-0" role="img" :aria-label="label" :data-render-count="renderCount" />
            <!-- Names over heads; the canvas's label already lists everyone. -->
            <span
                v-for="chip in chips"
                :key="chip.id"
                data-testid="name-chip"
                class="pointer-events-none absolute max-w-[9rem] -translate-x-1/2 -translate-y-full truncate rounded-full bg-background/85 px-2 py-0.5 text-xs font-semibold"
                :style="{ left: `${chip.x}px`, top: `${chip.y}px` }"
                aria-hidden="true"
            >
                {{ chip.text }}
            </span>
            <p
                v-if="paused"
                class="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-md bg-background/90 px-3 py-2 text-sm"
                role="status"
            >
                3D view paused
            </p>
        </div>
        <div class="flex flex-wrap gap-2" aria-label="Camera">
            <Button
                v-for="option in CAMERA_PRESETS"
                :key="option"
                size="sm"
                :variant="preset === option ? 'default' : 'outline'"
                :aria-pressed="preset === option ? 'true' : 'false'"
                @click="choose(option)"
            >
                {{ PRESET_LABELS[option] }}
            </Button>
        </div>

        <!-- The 2D court, drawn once into the 3D floor texture. Off-screen,
             not hidden: html-to-image needs it laid out. -->
        <div ref="courtHost" class="pointer-events-none fixed -left-[200rem] top-0 w-[65rem]" aria-hidden="true">
            <CourtFloor :court="rasterCourt" :logo-url="rasterLogo" :drawing-url="rasterDrawing" decorative />
        </div>
    </div>
</template>
