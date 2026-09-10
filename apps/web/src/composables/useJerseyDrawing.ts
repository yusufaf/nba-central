import { computed, ref } from "vue";

export interface StrokePoint {
    x: number;
    y: number;
}

export interface Stroke {
    points: StrokePoint[];
    color: string;
    width: number;
}

export interface CanvasRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export const DEFAULT_STROKE_COLOR = "hsl(0 0% 100%)";
export const DEFAULT_STROKE_WIDTH = 6;

/**
 * Maps a pointer event's client-space coordinates into the canvas's own
 * pixel space. The canvas element is CSS-scaled to fit its container, so raw
 * event coordinates only line up with the canvas's internal `width`/`height`
 * attributes at exactly 1:1 display size - the bug that made the original
 * drawing canvas put ink wherever the cursor happened to land instead of
 * under it at every size but one.
 */
export const clientToCanvasPoint = (
    rect: CanvasRect,
    canvasWidth: number,
    canvasHeight: number,
    clientX: number,
    clientY: number,
): StrokePoint => ({
    x: ((clientX - rect.left) / rect.width) * canvasWidth,
    y: ((clientY - rect.top) / rect.height) * canvasHeight,
});

/**
 * Pure stroke state for the jersey drawing canvas - no DOM, no canvas
 * context. Strokes are the source of truth and every repaint replays them
 * from here, so a re-render is a replay rather than a reset - the original
 * canvas repainted itself blank on every reactive change because it drew
 * once into a canvas element with nothing behind that draw to replay from.
 */
export function useJerseyDrawing() {
    const strokes = ref<Stroke[]>([]);
    const strokeColor = ref<string>(DEFAULT_STROKE_COLOR);
    const strokeWidth = ref<number>(DEFAULT_STROKE_WIDTH);

    const canUndo = computed(() => strokes.value.length > 0);
    const isEmpty = computed(() => strokes.value.length === 0);

    const beginStroke = (point: StrokePoint): void => {
        strokes.value.push({
            points: [point],
            color: strokeColor.value,
            width: strokeWidth.value,
        });
    };

    const extendStroke = (point: StrokePoint): void => {
        const current = strokes.value[strokes.value.length - 1];
        if (!current) return;
        current.points.push(point);
    };

    const undo = (): void => {
        strokes.value = strokes.value.slice(0, -1);
    };

    const clear = (): void => {
        strokes.value = [];
    };

    return {
        strokes,
        strokeColor,
        strokeWidth,
        canUndo,
        isEmpty,
        beginStroke,
        extendStroke,
        undo,
        clear,
    };
}
