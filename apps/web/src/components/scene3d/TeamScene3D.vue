<script setup lang="ts">
// The team's arena in 3D (#286): the court from its 2D design inside a seating
// bowl, with camera presets. Loaded lazily through ./index.ts; never import it
// directly, or three.js lands in the page's own chunk.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import CourtFloor from '@/components/court/CourtFloor.vue';
import { Button } from '@/components/ui/button';
import Scene3DUnavailable from './Scene3DUnavailable.vue';
import { useSceneMotion } from './sceneMotion';
import { useContextWatch } from './contextWatch';
import { DEFAULT_VIEWPORT_CLASS } from './viewport';
import { DEFAULT_COURT, courtAttempts } from './courtRaster';
import { track } from '@/lib/analytics';
import type { CourtDesign, TeamUniform, VenueDesign } from '@/models/api';
import { bannersDesign } from '@/three/arena/banners';
import { rasteriseCourt } from '@/three/arena/rasteriseCourt';
import { loadJerseyColours, type KitColours } from '@/utils/jerseyColours';
import type { PersonInput } from '@/three/character/person';
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
        uniform?: TeamUniform | null;
        venue?: VenueDesign | null;
        initialPreset?: CameraPreset;
        presets?: readonly CameraPreset[];
        viewportClass?: string;
        // Tags the analytics events, so the arena editor's preview can be told apart.
        page?: string;
    }>(),
    {
        logoUrl: undefined,
        drawingUrl: undefined,
        people: () => [],
        jerseyUrl: undefined,
        teamName: '',
        uniform: null,
        venue: null,
        initialPreset: 'team',
        presets: () => CAMERA_PRESETS,
        viewportClass: DEFAULT_VIEWPORT_CLASS,
        page: undefined,
    },
);
const tagged = <T extends object>(data: T) => ({ ...data, ...(props.page && { page: props.page }) });
const emit = defineEmits<{ failed: [reason: 'context-lost'] }>();

const viewport = ref<HTMLElement | null>(null);
const courtHost = ref<HTMLElement | null>(null);
const scene = shallowRef<TeamScene | null>(null);
const preset = ref<CameraPreset>(props.initialPreset);
const renderCount = ref(0);
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

// The team's people, in the owner's uniform colours or ones read off its
// jersey (once per URL).
let kitFor: { url: string | undefined; colours: Promise<KitColours> } | null = null;
const placePeople = async () => {
    const current = scene.value;
    if (!current) return;
    let colours = props.uniform;
    if (!colours) {
        if (!kitFor || kitFor.url !== props.jerseyUrl) kitFor = { url: props.jerseyUrl, colours: loadJerseyColours(props.jerseyUrl) };
        colours = await kitFor.colours;
    }
    if (scene.value !== current) return;
    // The arena stays up without them; a later prop change tries again.
    try {
        await current.setPeople(props.people, { colours, teamName: props.teamName });
    } catch {
        track('scene3d_failed', tagged({ reason: 'people' }));
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
    scene.value?.setCourt(canvas);
};

const choose = (next: CameraPreset) => {
    preset.value = next;
    scene.value?.setPreset(next);
    track('scene3d_preset', tagged({ preset: next }));
};

// The Banners shot (#322) only where there are banners to frame.
const offered = computed(() => {
    const banners = bannersDesign(props.venue).length > 0;
    return props.presets.filter((option) => option !== 'banners' || banners);
});
// Removing the last banner leaves nothing to frame: back to the starting shot,
// untracked. Immediate, so a scene never starts on a shot it doesn't offer.
watch(
    offered,
    (options) => {
        if (options.includes(preset.value)) return;
        const next = options.includes(props.initialPreset) ? props.initialPreset : options[0];
        if (!next) return;
        preset.value = next;
        scene.value?.setPreset(next);
    },
    { immediate: true },
);

// A lost context pauses the scene; one that never comes back falls back to the note.
const {
    paused,
    gone,
    start: watchContext,
} = useContextWatch({
    tags: () => tagged({}),
    onRestored: () => scene.value?.requestRender(),
    onGone: () => {
        scene.value?.dispose();
        scene.value = null;
        emit('failed', 'context-lost');
    },
});

// The ribbon scrolls unless reduced motion is on or the screen is a touch screen.
const motion = useSceneMotion();

onMounted(() => {
    if (!viewport.value) return;
    let created: TeamScene;
    try {
        created = new TeamScene(viewport.value);
    } catch {
        unavailable.value = true;
        track('scene3d_failed', tagged({ reason: 'no-webgl' }));
        return;
    }
    created.onRender = () => {
        renderCount.value = created.renderCount;
        compact.value = (viewport.value?.clientWidth || Infinity) < COMPACT_BELOW_PX;
        anchors.value = created.labelAnchors();
    };
    scene.value = created;
    if (preset.value !== 'team') created.setPreset(preset.value);
    created.setMotion(motion.value);
    created.setBowl(props.capacity, props.venue);
    watchContext();
    void rasterise();
    void placePeople();
});

watch([() => props.people, () => props.jerseyUrl, () => props.teamName, () => props.uniform], () => void placePeople());

watch([() => props.court, () => props.logoUrl, () => props.drawingUrl], () => void rasterise());

watch(motion, (on) => scene.value?.setMotion(on));

// Seats are rebuilt on their own, so a colour edit never re-rasterises the court.
watch(
    [() => props.capacity, () => props.venue],
    () => scene.value?.setBowl(props.capacity, props.venue ?? null),
    { deep: true },
);

onBeforeUnmount(() => {
    unmounted = true;
    scene.value?.dispose();
    scene.value = null;
});
</script>

<template>
    <Scene3DUnavailable v-if="unavailable || gone" :reason="unavailable ? 'no-webgl' : 'context-lost'" />
    <div v-else class="flex flex-col gap-3">
        <div class="relative overflow-hidden rounded-xl border border-border bg-card" :class="viewportClass">
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
            <!-- Always rendered, so screen readers announce the text when it changes. -->
            <p
                class="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 text-sm"
                :class="paused && 'rounded-md bg-background/90 px-3 py-2'"
                role="status"
            >
                {{ paused ? '3D view paused' : '' }}
            </p>
        </div>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Camera">
            <Button
                v-for="option in offered"
                :key="option"
                type="button"
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
