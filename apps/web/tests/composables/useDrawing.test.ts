import { describe, it, expect } from "vitest";
import {
    clientToCanvasPoint,
    dataUrlBytes,
    dataUrlToBlob,
    DEFAULT_STROKE_COLOR,
    DEFAULT_STROKE_WIDTH,
    paintStrokes,
    useDrawing,
} from "@/composables/useDrawing";
import { fakeContext } from "../helpers/fakeCanvas";

describe("paintStrokes", () => {
    it("starts every stroke on its own path, so two strokes are never joined (#47)", () => {
        const ctx = fakeContext();
        paintStrokes(ctx.context, [
            { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: "#ffffff", width: 6 },
            { points: [{ x: 500, y: 500 }, { x: 510, y: 510 }], color: "#000000", width: 12 },
        ]);

        expect(ctx.paths()).toEqual([
            [["moveTo", 0, 0], ["lineTo", 10, 10]],
            [["moveTo", 500, 500], ["lineTo", 510, 510]],
        ]);
    });

    it("draws a tap as a dot", () => {
        const ctx = fakeContext();
        paintStrokes(ctx.context, [{ points: [{ x: 4, y: 5 }], color: "#ffffff", width: 6 }]);
        expect(ctx.calls.filter(([name]) => name === "arc")).toEqual([["arc", 4, 5, 3, 0, Math.PI * 2]]);
    });
});

describe("drawing size helpers", () => {
    it("estimates a data URL's decoded size the way the jersey always has", () => {
        expect(dataUrlBytes("data:image/png;base64,AAAA")).toBe(Math.ceil((26 * 3) / 4));
    });

    it("turns a PNG data URL back into a PNG blob", async () => {
        const blob = dataUrlToBlob(`data:image/png;base64,${btoa("png bytes")}`);
        expect(blob.type).toBe("image/png");
        expect(await blob.text()).toBe("png bytes");
    });
});

describe("clientToCanvasPoint", () => {
    it("maps 1:1 when the canvas is displayed at its native resolution", () => {
        const rect = { left: 0, top: 0, width: 900, height: 1253 };
        expect(clientToCanvasPoint(rect, 900, 1253, 450, 600)).toEqual({ x: 450, y: 600 });
    });

    it("scales client coordinates when the canvas is CSS-scaled down", () => {
        // Displayed at half size - the bug the original canvas had at any
        // size other than its literal pixel dimensions.
        const rect = { left: 0, top: 0, width: 450, height: 626.5 };
        expect(clientToCanvasPoint(rect, 900, 1253, 225, 313.25)).toEqual({ x: 450, y: 626.5 });
    });

    it("accounts for the canvas's offset within the page", () => {
        const rect = { left: 100, top: 50, width: 900, height: 1253 };
        expect(clientToCanvasPoint(rect, 900, 1253, 150, 100)).toEqual({ x: 50, y: 50 });
    });
});

describe("useDrawing", () => {
    it("starts empty", () => {
        const { strokes, isEmpty, canUndo } = useDrawing();
        expect(strokes.value).toEqual([]);
        expect(isEmpty.value).toBe(true);
        expect(canUndo.value).toBe(false);
    });

    it("defaults to a literal hex color, not a token an <input type=\"color\"> can't parse", () => {
        expect(DEFAULT_STROKE_COLOR).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("starts on the default width, or the one a larger surface asks for", () => {
        expect(useDrawing().strokeWidth.value).toBe(DEFAULT_STROKE_WIDTH);
        expect(useDrawing({ strokeWidth: 12 }).strokeWidth.value).toBe(12);
    });

    it("begins a stroke with the current color and width", () => {
        const { strokes, strokeColor, strokeWidth, beginStroke, isEmpty } = useDrawing();
        strokeColor.value = "#000000";
        strokeWidth.value = 8;

        beginStroke({ x: 1, y: 2 });

        expect(isEmpty.value).toBe(false);
        expect(strokes.value).toEqual([
            { points: [{ x: 1, y: 2 }], color: "#000000", width: 8 },
        ]);
    });

    it("extends the most recent stroke without starting a new one", () => {
        const { strokes, beginStroke, extendStroke } = useDrawing();
        beginStroke({ x: 0, y: 0 });
        extendStroke({ x: 1, y: 1 });
        extendStroke({ x: 2, y: 2 });

        expect(strokes.value).toHaveLength(1);
        expect(strokes.value[0].points).toEqual([
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 2 },
        ]);
    });

    it("does nothing when extending before any stroke has begun", () => {
        const { strokes, extendStroke } = useDrawing();
        extendStroke({ x: 1, y: 1 });
        expect(strokes.value).toEqual([]);
    });

    it("keeps separate strokes separate - a new stroke does not join the previous one's end point", () => {
        // Regression check for #47: the original canvas never seeded a new
        // stroke's start point, so it drew a straight line from wherever the
        // previous stroke ended to wherever the new one began.
        const { strokes, beginStroke, extendStroke } = useDrawing();
        beginStroke({ x: 0, y: 0 });
        extendStroke({ x: 10, y: 10 });

        beginStroke({ x: 500, y: 500 });
        extendStroke({ x: 510, y: 510 });

        expect(strokes.value).toHaveLength(2);
        expect(strokes.value[0].points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
        expect(strokes.value[1].points).toEqual([{ x: 500, y: 500 }, { x: 510, y: 510 }]);
    });

    it("undo removes only the most recent stroke", () => {
        const { strokes, beginStroke, undo, canUndo } = useDrawing();
        beginStroke({ x: 0, y: 0 });
        beginStroke({ x: 1, y: 1 });

        undo();

        expect(strokes.value).toHaveLength(1);
        expect(strokes.value[0].points).toEqual([{ x: 0, y: 0 }]);
        expect(canUndo.value).toBe(true);

        undo();
        expect(strokes.value).toEqual([]);
        expect(canUndo.value).toBe(false);
    });

    it("undo on an empty canvas is a no-op", () => {
        const { strokes, undo } = useDrawing();
        undo();
        expect(strokes.value).toEqual([]);
    });

    it("clear drops every stroke at once", () => {
        const { strokes, beginStroke, clear, isEmpty } = useDrawing();
        beginStroke({ x: 0, y: 0 });
        beginStroke({ x: 1, y: 1 });
        beginStroke({ x: 2, y: 2 });

        clear();

        expect(strokes.value).toEqual([]);
        expect(isEmpty.value).toBe(true);
    });
});
