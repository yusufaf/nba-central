<script setup lang="ts">
// The team's arena in 3D (#286): the court from its 2D design inside a seating
// bowl, with camera presets. Loaded lazily through ./index.ts; never import it
// directly, or three.js lands in the page's own chunk.
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import CourtFloor from '@/components/court/CourtFloor.vue';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import type { CourtDesign } from '@/models/api';
import { newCourt } from '@/utils/court';
import { rasteriseCourt } from '@/three/arena/rasteriseCourt';
import { onContextChange } from '@/three/renderer/shared';
import { CAMERA_PRESETS, PRESET_LABELS, type CameraPreset } from '@/three/scene/cameraPresets';
import { TeamScene } from '@/three/scene/teamScene';

const props = defineProps<{
    court: CourtDesign | null;
    logoUrl?: string;
    drawingUrl?: string;
    capacity: number | null;
    label: string;
}>();
const emit = defineEmits<{ failed: [reason: 'context-lost'] }>();

// Teams on a built-in arena (or none) get a plain court, never an NBA replica.
const DEFAULT_COURT: CourtDesign = { ...newCourt(''), centerLogo: 'none' };

const viewport = ref<HTMLElement | null>(null);
const courtHost = ref<HTMLElement | null>(null);
const scene = shallowRef<TeamScene | null>(null);
const preset = ref<CameraPreset>('team');
const renderCount = ref(0);
const paused = ref(false);

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
    const attempts = [
        { logo: props.logoUrl, drawing: props.drawingUrl },
        { logo: undefined, drawing: props.drawingUrl },
        { logo: undefined, drawing: undefined },
    ].filter(
        (attempt, i, all) =>
            i === 0 || attempt.logo !== all[i - 1].logo || attempt.drawing !== all[i - 1].drawing,
    );
    let canvas: HTMLCanvasElement | null = null;
    for (const attempt of attempts) {
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
    const created = new TeamScene(viewport.value);
    created.onRender = () => (renderCount.value = created.renderCount);
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
});

watch(() => [props.court, props.logoUrl, props.drawingUrl, props.capacity], () => void rasterise());

onBeforeUnmount(() => {
    unmounted = true;
    stopContext?.();
    scene.value?.dispose();
    scene.value = null;
});
</script>

<template>
    <div class="flex flex-col gap-3">
        <div class="relative h-[min(70vh,40rem,160vw)] overflow-hidden rounded-xl border border-border bg-card">
            <div ref="viewport" class="absolute inset-0" role="img" :aria-label="label" :data-render-count="renderCount" />
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
