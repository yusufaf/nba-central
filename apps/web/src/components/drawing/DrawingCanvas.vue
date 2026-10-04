<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Eraser, Undo2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    clientToCanvasPoint,
    dataUrlBytes,
    DEFAULT_STROKE_WIDTH,
    paintStrokes,
    useDrawing,
    type StrokePoint,
} from "@/composables/useDrawing";

// One freehand drawing surface, for the jersey and the court. The owner
// passes the stroke state in (useDrawing), so it outlives this component
// when a dialog tab unmounts it. After every stroke, Undo and Clear the
// strokes are flattened onto the template, if any, and emitted as a PNG
// data URL, or null when they can't be saved: over maxBytes, or the
// template hasn't loaded (it commits again once it has). The backdrop and
// overlay slots are shown under and over the ink but never exported.
const props = withDefaults(
    defineProps<{
        drawing: ReturnType<typeof useDrawing>;
        // The canvas's own resolution; it is shown scaled to fit.
        width: number;
        height: number;
        // An image flattened under the strokes in the export.
        template?: string | null;
        maxBytes: number;
        // Multiplies the brush widths, for a surface drawn at a higher resolution.
        brushScale?: number;
        // Undo only reaches this session's strokes on top of a saved drawing.
        editingSaved?: boolean;
        maxWidth?: string;
        label?: string;
        tooLargeMessage?: string;
        templateErrorMessage?: string;
    }>(),
    {
        template: null,
        brushScale: 1,
        editingSaved: false,
        maxWidth: undefined,
        label: "Drawing canvas",
        tooLargeMessage: "This drawing is too detailed to save - try Clear and a simpler design.",
        templateErrorMessage: "Couldn't load the saved drawing, so changes can't be saved right now - try reopening this dialog.",
    },
);

const emit = defineEmits<{
    commit: [dataUrl: string | null];
}>();

// Literal hex, not `hsl(var(--primary))` - Canvas2D's strokeStyle/fillStyle
// parses its own value directly and does not resolve CSS custom properties,
// so a var() assignment is silently ignored and the ink stays whatever
// color was last validly set. Hex specifically (not hsl()) because
// ColorPicker (below) round-trips strokeColor through reka-ui's Color type,
// which normalizes to hex - keeping every entry in that same format means
// strokeColor never needs a conversion step on the preset side either.
// "Team orange" mirrors --primary's current value (35 100% 50%, see
// DESIGN.md) converted to hex.
const STROKE_COLORS = [
    { label: "White", value: "#ffffff" },
    { label: "Black", value: "#000000" },
    { label: "Team orange", value: "#ff9500" },
    { label: "Sky blue", value: "#259df4" },
    { label: "Crimson", value: "#df2030" },
];

const WIDTH_OPTIONS = [
    { value: "thin", label: "Thin", width: 3 },
    { value: "medium", label: "Medium", width: DEFAULT_STROKE_WIDTH },
    { value: "thick", label: "Thick", width: 12 },
];

const { strokes, strokeColor, strokeWidth, canUndo, isEmpty, beginStroke, extendStroke, undo, clear } = props.drawing;

// Deselecting the current width falls back to Medium.
const widthOption = computed({
    get: () =>
        WIDTH_OPTIONS.find((option) => option.width * props.brushScale === strokeWidth.value)?.value ?? "medium",
    set: (value: string | undefined) => {
        const option = WIDTH_OPTIONS.find((candidate) => candidate.value === value) ?? WIDTH_OPTIONS[1];
        strokeWidth.value = option.width * props.brushScale;
    },
});

const isCustomColor = computed(() => !STROKE_COLORS.some((swatch) => swatch.value === strokeColor.value));

// The template is decoded once per src rather than on every commit, since
// it never changes between strokes. Until it has loaded (or once it's gone)
// the export can't include it.
const templateImage = ref<HTMLImageElement | null>(null);
const templateLoadError = ref(false);
// A change made while the template was loading, exported once it arrives.
let commitWhenLoaded = false;

const loadTemplate = (src: string | null) => {
    templateImage.value = null;
    templateLoadError.value = false;
    commitWhenLoaded = false;
    if (!src) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
        if (props.template !== src) return;
        templateImage.value = image;
        if (commitWhenLoaded) commit();
    };
    image.onerror = () => {
        if (props.template === src) templateLoadError.value = true;
    };
    image.src = src;
};

watch(() => props.template, loadTemplate, { immediate: true });

const canvasEl = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
const sizeError = ref<string | null>(null);

const redraw = () => {
    const canvas = canvasEl.value;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintStrokes(ctx, strokes.value);
};

// Strokes are the source of truth and every render replays them in full,
// so a reactive change can't blank the canvas: the next redraw just draws
// the same array again.
watch(strokes, redraw, { deep: true });
onMounted(redraw);

const pointFromEvent = (event: PointerEvent): StrokePoint | null => {
    const canvas = canvasEl.value;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return clientToCanvasPoint(rect, canvas.width, canvas.height, event.clientX, event.clientY);
};

const handlePointerDown = (event: PointerEvent) => {
    const point = pointFromEvent(event);
    if (!point) return;
    canvasEl.value?.setPointerCapture(event.pointerId);
    isDrawing.value = true;
    beginStroke(point);
};

const handlePointerMove = (event: PointerEvent) => {
    if (!isDrawing.value) return;
    const point = pointFromEvent(event);
    if (!point) return;
    extendStroke(point);
};

/**
 * Composites the template and the stroke canvas offscreen and emits the
 * result. Nothing calls toDataURL until there's a finished stroke worth
 * reading back.
 */
function commit() {
    sizeError.value = null;
    commitWhenLoaded = false;

    const canvas = canvasEl.value;
    if (!canvas) return;
    // Without the template the export would drop it, and the owner's last
    // export no longer matches the strokes either way.
    if (props.template && !templateImage.value) {
        commitWhenLoaded = !templateLoadError.value;
        emit("commit", null);
        return;
    }

    const output = document.createElement("canvas");
    output.width = props.width;
    output.height = props.height;
    const ctx = output.getContext("2d");
    if (!ctx) return;

    if (templateImage.value) ctx.drawImage(templateImage.value, 0, 0, props.width, props.height);
    ctx.drawImage(canvas, 0, 0);

    const dataUrl = output.toDataURL("image/png");
    if (dataUrlBytes(dataUrl) > props.maxBytes) {
        sizeError.value = props.tooLargeMessage;
        emit("commit", null);
        return;
    }
    emit("commit", dataUrl);
}

const stopDrawing = () => {
    if (!isDrawing.value) return;
    isDrawing.value = false;
    commit();
};

const handleUndo = () => {
    undo();
    commit();
};

const handleClear = () => {
    clear();
    commit();
};

defineExpose({ resetError: () => (sizeError.value = null) });
</script>

<template>
    <div class="drawing">
        <div class="drawing-surface" :style="{ aspectRatio: `${width} / ${height}`, maxWidth }">
            <div v-if="$slots.backdrop" class="drawing-layer pointer-events-none" aria-hidden="true">
                <slot name="backdrop" />
            </div>
            <img
                v-if="template"
                :src="template"
                crossorigin="anonymous"
                alt=""
                class="drawing-layer drawing-template"
                data-part="template"
                draggable="false"
            />
            <canvas
                ref="canvasEl"
                :width="width"
                :height="height"
                class="drawing-canvas"
                :aria-label="label"
                @pointerdown="handlePointerDown"
                @pointermove="handlePointerMove"
                @pointerup="stopDrawing"
                @pointercancel="stopDrawing"
                @pointerleave="stopDrawing"
            />
            <div v-if="$slots.overlay" class="drawing-layer pointer-events-none" aria-hidden="true">
                <slot name="overlay" />
            </div>
        </div>

        <div class="drawing-controls">
            <div class="drawing-swatches" role="group" aria-label="Stroke color">
                <button
                    v-for="swatch in STROKE_COLORS"
                    :key="swatch.value"
                    type="button"
                    class="drawing-swatch"
                    :class="{ selected: strokeColor === swatch.value }"
                    :style="{ '--swatch-color': swatch.value }"
                    :aria-label="swatch.label"
                    :aria-pressed="strokeColor === swatch.value"
                    @click="strokeColor = swatch.value"
                />
                <ColorPicker v-model="strokeColor" :selected="isCustomColor" />
            </div>

            <ToggleGroup v-model="widthOption" type="single" class="drawing-width-group">
                <ToggleGroupItem
                    v-for="option in WIDTH_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                    class="drawing-width-item"
                >
                    {{ option.label }}
                </ToggleGroupItem>
            </ToggleGroup>

            <div class="drawing-actions">
                <Button type="button" variant="outline" size="sm" :disabled="!canUndo" @click="handleUndo">
                    <Undo2 class="h-4 w-4" />
                    Undo
                </Button>
                <Button type="button" variant="outline" size="sm" :disabled="isEmpty" @click="handleClear">
                    <Eraser class="h-4 w-4" />
                    Clear
                </Button>
                <slot name="actions" />
            </div>
        </div>

        <p v-if="templateLoadError" role="alert" class="drawing-error">{{ templateErrorMessage }}</p>
        <p v-else-if="sizeError" role="alert" class="drawing-error">{{ sizeError }}</p>
        <p v-else-if="editingSaved" class="drawing-hint">
            Editing your saved drawing - Undo only covers strokes made in this session.
        </p>
    </div>
</template>

<style scoped>
.drawing {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.drawing-surface {
    position: relative;
    width: 100%;
    border: 0.0625rem solid hsl(var(--border));
    border-radius: var(--radius);
    overflow: hidden;
    background: hsl(var(--foreground) / 0.04);
    touch-action: none;
}

.drawing-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.drawing-template {
    object-fit: contain;
    pointer-events: none;
    user-select: none;
}

.drawing-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
}

.drawing-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
}

.drawing-swatches {
    display: flex;
    gap: 0.375rem;
}

.drawing-swatch {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    border: 0.125rem solid hsl(var(--border));
    background: var(--swatch-color);
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.drawing-swatch:hover {
    border-color: hsl(var(--primary) / 0.6);
}

.drawing-swatch.selected {
    border-color: hsl(var(--primary-strong));
    box-shadow: 0 0 0 0.125rem hsl(var(--primary) / 0.3);
}

.drawing-width-item {
    font-size: 0.75rem;
}

.drawing-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.drawing-hint,
.drawing-error {
    margin: 0;
    font-size: 0.75rem;
}

.drawing-hint {
    color: hsl(var(--muted-foreground));
}

.drawing-error {
    color: hsl(var(--destructive-strong));
}
</style>
