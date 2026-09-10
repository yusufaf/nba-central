<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { Eraser, Undo2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import jerseyTemplate from "@/assets/basketball_jersey.png";
import {
    clientToCanvasPoint,
    DEFAULT_STROKE_WIDTH,
    useJerseyDrawing,
    type StrokePoint,
} from "@/composables/useJerseyDrawing";

// Matches basketball_jersey.png's natural size - fixed rather than read at
// runtime so the canvas has its final resolution on first paint instead of
// resizing once the template image loads.
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 1253;

// A saved team caps out well under DynamoDB's 400KB item limit even with a
// full roster, so this is a generous ceiling meant to catch a pathological
// drawing, not a normal one.
const MAX_JERSEY_DATA_URL_BYTES = 200 * 1024;

// Literal HSL, not `hsl(var(--primary))` - Canvas2D's strokeStyle/fillStyle
// parses its own value directly and does not resolve CSS custom properties,
// so a var() assignment is silently ignored and the ink stays whatever
// color was last validly set. "Team orange" mirrors --primary's current
// value (35 100% 50%, see DESIGN.md) as a plain literal for that reason.
const STROKE_COLORS = [
    { label: "White", value: "hsl(0 0% 100%)" },
    { label: "Black", value: "hsl(0 0% 0%)" },
    { label: "Team orange", value: "hsl(35 100% 50%)" },
    { label: "Sky blue", value: "hsl(205 90% 55%)" },
    { label: "Crimson", value: "hsl(355 75% 50%)" },
];

const WIDTH_OPTIONS = [
    { value: "thin", label: "Thin", width: 3 },
    { value: "medium", label: "Medium", width: DEFAULT_STROKE_WIDTH },
    { value: "thick", label: "Thick", width: 12 },
];

const teamJersey = defineModel<string>("teamJersey");

// Captured once on mount, not reactive to teamJersey afterward - this
// component is the only writer of teamJersey while it's active, and if the
// background tracked every commit, the *next* commit would draw a
// background that already has earlier strokes baked in underneath a canvas
// overlay that replays every stroke again, doubling them up.
const initialJersey = teamJersey.value ?? "";
const isEditingSavedDrawing = initialJersey.startsWith("data:");
const backgroundSrc = ref<string>(isEditingSavedDrawing ? initialJersey : jerseyTemplate);

const canvasEl = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
const sizeError = ref<string | null>(null);
const selectedWidthOption = ref<string>("medium");

const {
    strokes,
    strokeColor,
    strokeWidth,
    canUndo,
    isEmpty,
    beginStroke,
    extendStroke,
    undo,
    clear,
} = useJerseyDrawing();

watch(selectedWidthOption, (value) => {
    const option = WIDTH_OPTIONS.find((candidate) => candidate.value === value);
    if (option) strokeWidth.value = option.width;
});

const redraw = () => {
    const canvas = canvasEl.value;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes.value) {
        if (stroke.points.length === 0) continue;

        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (stroke.points.length === 1) {
            // A tap without a drag - draw a dot so it isn't invisible.
            const [point] = stroke.points;
            ctx.beginPath();
            ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
            ctx.fill();
            continue;
        }

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const point of stroke.points.slice(1)) {
            ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
    }
};

// Strokes are the source of truth and every render replays them in full -
// this is what a reactive change can no longer blank the canvas: there's
// nothing to lose, the next redraw just draws the same array again.
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
 * Composites the background layer and the stroke canvas offscreen and
 * writes the result into teamJersey as a data: URL - the same string field
 * the historical picker's CloudFront URL already goes through end to end,
 * so it saves and reloads with no backend change. Unlike the original
 * canvas, nothing here calls toDataURL until there's a finished stroke
 * worth reading back.
 */
const commit = () => {
    sizeError.value = null;

    const canvas = canvasEl.value;
    if (!canvas) return;

    const background = new Image();
    background.onload = () => {
        const output = document.createElement("canvas");
        output.width = CANVAS_WIDTH;
        output.height = CANVAS_HEIGHT;
        const ctx = output.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(canvas, 0, 0);

        const dataUrl = output.toDataURL("image/png");
        const approxBytes = Math.ceil((dataUrl.length * 3) / 4);
        if (approxBytes > MAX_JERSEY_DATA_URL_BYTES) {
            sizeError.value = "This drawing is too detailed to save - try Clear and a simpler design.";
            return;
        }

        teamJersey.value = dataUrl;
    };
    background.src = backgroundSrc.value;
};

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

const startOver = () => {
    clear();
    backgroundSrc.value = jerseyTemplate;
    teamJersey.value = "";
    sizeError.value = null;
};
</script>

<template>
    <div class="jersey-drawing">
        <div class="jersey-canvas-wrap">
            <img :src="backgroundSrc" alt="" class="jersey-background" draggable="false" />
            <canvas
                ref="canvasEl"
                :width="CANVAS_WIDTH"
                :height="CANVAS_HEIGHT"
                class="jersey-canvas"
                @pointerdown="handlePointerDown"
                @pointermove="handlePointerMove"
                @pointerup="stopDrawing"
                @pointercancel="stopDrawing"
                @pointerleave="stopDrawing"
            />
        </div>

        <div class="jersey-controls">
            <div class="jersey-swatches" role="group" aria-label="Stroke color">
                <button
                    v-for="swatch in STROKE_COLORS"
                    :key="swatch.value"
                    type="button"
                    class="jersey-swatch"
                    :class="{ selected: strokeColor === swatch.value }"
                    :style="{ '--swatch-color': swatch.value }"
                    :aria-label="swatch.label"
                    :aria-pressed="strokeColor === swatch.value"
                    @click="strokeColor = swatch.value"
                />
            </div>

            <ToggleGroup
                v-model="selectedWidthOption"
                type="single"
                class="jersey-width-group"
                @update:model-value="(value) => { if (!value) selectedWidthOption = 'medium'; }"
            >
                <ToggleGroupItem
                    v-for="option in WIDTH_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                    class="jersey-width-item"
                >
                    {{ option.label }}
                </ToggleGroupItem>
            </ToggleGroup>

            <div class="jersey-actions">
                <Button type="button" variant="outline" size="sm" :disabled="!canUndo" @click="handleUndo">
                    <Undo2 class="h-4 w-4" />
                    Undo
                </Button>
                <Button type="button" variant="outline" size="sm" :disabled="isEmpty" @click="handleClear">
                    <Eraser class="h-4 w-4" />
                    Clear
                </Button>
                <Button
                    v-if="isEditingSavedDrawing || !isEmpty"
                    type="button"
                    variant="ghost"
                    size="sm"
                    @click="startOver"
                >
                    Start over
                </Button>
            </div>
        </div>

        <p v-if="sizeError" class="jersey-error">{{ sizeError }}</p>
        <p v-else-if="isEditingSavedDrawing" class="jersey-hint">
            Editing your saved drawing - Undo only covers strokes made in this session.
        </p>
    </div>
</template>

<style scoped>
.jersey-drawing {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.jersey-canvas-wrap {
    position: relative;
    width: 100%;
    max-width: 20rem;
    aspect-ratio: 900 / 1253;
    border: 0.0625rem solid hsl(var(--border));
    border-radius: var(--radius);
    overflow: hidden;
    background: hsl(0 0% 100% / 0.04);
    touch-action: none;
}

.jersey-background {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
}

.jersey-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
}

.jersey-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
}

.jersey-swatches {
    display: flex;
    gap: 0.375rem;
}

.jersey-swatch {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    border: 0.125rem solid hsl(var(--border));
    background: var(--swatch-color);
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.jersey-swatch:hover {
    border-color: hsl(var(--primary) / 0.6);
}

.jersey-swatch.selected {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 0.125rem hsl(var(--primary) / 0.3);
}

.jersey-width-item {
    font-size: 0.75rem;
}

.jersey-actions {
    display: flex;
    gap: 0.5rem;
}

.jersey-hint,
.jersey-error {
    margin: 0;
    font-size: 0.75rem;
}

.jersey-hint {
    color: hsl(var(--muted-foreground));
}

.jersey-error {
    color: hsl(var(--destructive));
}
</style>
