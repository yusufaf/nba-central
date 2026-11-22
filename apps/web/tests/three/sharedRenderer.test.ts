import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The shared renderer's lifecycle (#300), with a fake WebGLRenderer: jsdom has no WebGL.
const state = vi.hoisted(() => ({ lost: false, instances: [] as unknown[] }));

vi.mock('three', async (importOriginal) => {
    const actual = await importOriginal<typeof import('three')>();
    class FakeRenderer {
        domElement = document.createElement('canvas');
        ratio = 1;
        setPixelRatio = vi.fn((ratio: number) => {
            this.ratio = ratio;
        });
        getPixelRatio = vi.fn(() => this.ratio);
        setSize = vi.fn();
        getContext = () => ({ isContextLost: () => state.lost });
        constructor() {
            state.instances.push(this);
        }
    }
    return { ...actual, WebGLRenderer: FakeRenderer };
});

type Fake = { setPixelRatio: ReturnType<typeof vi.fn>; setSize: ReturnType<typeof vi.fn> };
type Shared = typeof import('@/three/renderer/shared');
let shared: Shared;

beforeEach(async () => {
    state.lost = false;
    state.instances.length = 0;
    vi.stubGlobal('devicePixelRatio', 1);
    vi.resetModules();
    shared = await import('@/three/renderer/shared');
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('the shared renderer (#300)', () => {
    it('isContextLost is false before any renderer exists, then reads the context', () => {
        expect(shared.isContextLost()).toBe(false);
        shared.getSharedRenderer();
        state.lost = true;
        expect(shared.isContextLost()).toBe(true);
    });

    it('a new renderer starts at one pixel', () => {
        const renderer = shared.getSharedRenderer() as unknown as Fake;
        expect(renderer.setSize).toHaveBeenCalledWith(1, 1, false);
    });

    it('releasing the last scene drops the drawing buffer', () => {
        const renderer = shared.acquireRenderer() as unknown as Fake;
        shared.acquireRenderer();
        renderer.setSize.mockClear();
        shared.releaseRenderer();
        expect(renderer.setSize).not.toHaveBeenCalled();
        shared.releaseRenderer();
        expect(renderer.setSize).toHaveBeenCalledWith(1, 1, false);
    });

    it('an extra release never goes below zero', () => {
        shared.releaseRenderer();
        const renderer = shared.acquireRenderer() as unknown as Fake;
        renderer.setSize.mockClear();
        shared.fitRenderer(shared.getSharedRenderer(), 800, 450);
        expect(renderer.setSize).toHaveBeenLastCalledWith(800, 450, false);
        shared.releaseRenderer();
        expect(renderer.setSize).toHaveBeenLastCalledWith(1, 1, false);
    });

    it('fitRenderer follows devicePixelRatio, capped at 1.5', () => {
        const renderer = shared.acquireRenderer();
        const fake = renderer as unknown as Fake;
        vi.stubGlobal('devicePixelRatio', 2);
        shared.fitRenderer(renderer, 800, 450);
        expect(fake.setPixelRatio).toHaveBeenLastCalledWith(shared.MAX_PIXEL_RATIO);
        vi.stubGlobal('devicePixelRatio', 1.25);
        shared.fitRenderer(renderer, 800, 450);
        expect(fake.setPixelRatio).toHaveBeenLastCalledWith(1.25);
    });

    it('fitRenderer leaves an unchanged ratio alone', () => {
        const renderer = shared.acquireRenderer();
        const fake = renderer as unknown as Fake;
        fake.setPixelRatio.mockClear();
        shared.fitRenderer(renderer, 800, 450);
        expect(fake.setPixelRatio).not.toHaveBeenCalled();
        expect(fake.setSize).toHaveBeenLastCalledWith(800, 450, false);
    });

    it('onPixelRatioChange re-arms on each new ratio and unsubscribes', () => {
        type Query = { media: string; listeners: Set<() => void> };
        const queries: Query[] = [];
        vi.stubGlobal(
            'matchMedia',
            vi.fn((media: string) => {
                const query: Query = { media, listeners: new Set() };
                queries.push(query);
                return {
                    media,
                    addEventListener: (_: string, listener: () => void) => query.listeners.add(listener),
                    removeEventListener: (_: string, listener: () => void) => query.listeners.delete(listener),
                };
            }),
        );
        const listener = vi.fn();
        const stop = shared.onPixelRatioChange(listener);
        expect(queries.map((query) => query.media)).toEqual(['(resolution: 1dppx)']);

        vi.stubGlobal('devicePixelRatio', 2);
        for (const fire of [...queries[0].listeners]) fire();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(queries[0].listeners.size).toBe(0);
        expect(queries[1].media).toBe('(resolution: 2dppx)');
        expect(queries[1].listeners.size).toBe(1);

        stop();
        expect(queries[1].listeners.size).toBe(0);
    });
});
