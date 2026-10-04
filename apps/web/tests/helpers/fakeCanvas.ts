import { vi } from "vitest";

export type Call = [string, ...unknown[]];

/**
 * A Canvas2D context that records what was drawn. jsdom has no canvas
 * backend, so tests assert on the calls instead of on pixels.
 */
export const fakeContext = () => {
    const calls: Call[] = [];
    const record =
        (name: string) =>
        (...args: unknown[]) => {
            calls.push([name, ...args]);
        };
    const context = {
        clearRect: record("clearRect"),
        beginPath: record("beginPath"),
        moveTo: record("moveTo"),
        lineTo: record("lineTo"),
        arc: record("arc"),
        stroke: record("stroke"),
        fill: record("fill"),
        drawImage: record("drawImage"),
        strokeStyle: "",
        fillStyle: "",
        lineWidth: 1,
        lineCap: "butt",
        lineJoin: "miter",
    } as unknown as CanvasRenderingContext2D;

    // Each beginPath..stroke run, as its moveTo/lineTo calls.
    const paths = () => {
        const out: Call[][] = [];
        let current: Call[] | null = null;
        for (const call of calls) {
            if (call[0] === "beginPath") current = [];
            else if ((call[0] === "moveTo" || call[0] === "lineTo") && current) current.push(call);
            else if (call[0] === "stroke" && current) {
                out.push(current);
                current = null;
            }
        }
        return out;
    };

    return { context, calls, paths, reset: () => calls.splice(0) };
};

/**
 * Gives every canvas a recording context and a stubbed toDataURL whose size
 * the test controls. Returns the context of each canvas, keyed by element.
 */
export const installFakeCanvas = () => {
    const contexts = new Map<HTMLCanvasElement, ReturnType<typeof fakeContext>>();
    const state = { dataUrlLength: 100 };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
        if (!contexts.has(this)) contexts.set(this, fakeContext());
        return contexts.get(this)!.context as never;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
        const prefix = "data:image/png;base64,";
        return prefix + "A".repeat(Math.max(0, state.dataUrlLength - prefix.length));
    });
    return { contexts, state };
};

/**
 * jsdom never loads an image's src. This makes every `new Image()` load (or,
 * for a src containing "dead", fail) on the next microtask. A src containing
 * "slow" waits until the test calls release().
 */
export const installFakeImages = () => {
    const loaded: string[] = [];
    const held: (() => void)[] = [];
    class FakeImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        crossOrigin: string | null = null;
        currentSrc = "";
        get src() {
            return this.currentSrc;
        }
        set src(value: string) {
            this.currentSrc = value;
            const settle = () => {
                if (value.includes("dead")) this.onerror?.();
                else {
                    loaded.push(value);
                    this.onload?.();
                }
            };
            if (value.includes("slow")) held.push(settle);
            else queueMicrotask(settle);
        }
    }
    vi.stubGlobal("Image", FakeImage);
    return { loaded, release: () => held.splice(0).forEach((settle) => settle()) };
};
