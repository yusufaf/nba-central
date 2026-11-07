import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Probe = typeof import('@/utils/webgl');

// The result is cached per page load, so each test gets a fresh module.
const load = async (): Promise<Probe> => {
    vi.resetModules();
    return import('@/utils/webgl');
};

const stubContexts = (contexts: Partial<Record<string, unknown>>) =>
    vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(((kind: string) => contexts[kind] ?? null) as typeof HTMLCanvasElement.prototype.getContext);

describe('isWebGLAvailable', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false when getContext returns null', async () => {
        stubContexts({});
        expect((await load()).isWebGLAvailable()).toBe(false);
    });

    it('returns true when webgl2 is available', async () => {
        stubContexts({ webgl2: { getExtension: () => null } });
        expect((await load()).isWebGLAvailable()).toBe(true);
    });

    it('returns false when only WebGL1 is available, since three.js needs WebGL2', async () => {
        stubContexts({ webgl: { getExtension: () => null } });
        expect((await load()).isWebGLAvailable()).toBe(false);
    });

    it('releases the probe context', async () => {
        const loseContext = vi.fn();
        stubContexts({ webgl2: { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null) } });
        (await load()).isWebGLAvailable();
        expect(loseContext).toHaveBeenCalledTimes(1);
    });

    it('probes once per page load', async () => {
        const spy = stubContexts({ webgl2: { getExtension: () => null } });
        const probe = await load();
        probe.isWebGLAvailable();
        probe.isWebGLAvailable();
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
