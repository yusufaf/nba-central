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

export const DEFAULT_STROKE_COLOR = "#ffffff";
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
 * Replays strokes into a context. Each stroke starts its own path at its own
 * first point, so one never continues from where the last ended (#47).
 */
export const paintStrokes = (ctx: CanvasRenderingContext2D, strokes: Stroke[]): void => {
    for (const stroke of strokes) {
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

/** Roughly what a base64 data URL decodes to, the prefix included. */
export const dataUrlBytes = (dataUrl: string): number => Math.ceil((dataUrl.length * 3) / 4);

export const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, base64] = dataUrl.split(",", 2);
    const type = /^data:([^;,]+)/.exec(header)?.[1] ?? "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
};

/**
 * Pure stroke state for a drawing surface - no DOM, no canvas context.
 * Strokes are the source of truth and every repaint replays them from here,
 * so a re-render is a replay rather than a reset - the original canvas
 * repainted itself blank on every reactive change because it drew once into
 * a canvas element with nothing behind that draw to replay from (#85). A
 * surface that unmounts while its owner stays open (a dialog tab) keeps
 * this state in the owner, so the strokes and Undo survive the remount.
 */
export function useDrawing(options: { strokeWidth?: number } = {}) {
    const strokes = ref<Stroke[]>([]);
    const strokeColor = ref<string>(DEFAULT_STROKE_COLOR);
    const strokeWidth = ref<number>(options.strokeWidth ?? DEFAULT_STROKE_WIDTH);

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
