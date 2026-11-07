import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { CourtDesign } from '@/models/api';

const mocks = vi.hoisted(() => ({
    scenes: [] as Array<{
        setArena: ReturnType<typeof vi.fn>;
        setPreset: ReturnType<typeof vi.fn>;
        requestRender: ReturnType<typeof vi.fn>;
        dispose: ReturnType<typeof vi.fn>;
        renderCount: number;
        onRender: (() => void) | null;
    }>,
    rasterise: vi.fn(),
    track: vi.fn(),
    contextListener: null as ((lost: boolean) => void) | null,
    unsubscribe: vi.fn(),
    failToStart: false,
}));

vi.mock('@/three/scene/teamScene', () => ({
    TeamScene: class {
        setArena = vi.fn();
        setPreset = vi.fn();
        requestRender = vi.fn();
        dispose = vi.fn();
        renderCount = 0;
        onRender: (() => void) | null = null;
        constructor() {
            if (mocks.failToStart) throw new Error('Error creating WebGL context.');
            mocks.scenes.push(this);
        }
    },
}));
vi.mock('@/three/arena/rasteriseCourt', () => ({ rasteriseCourt: mocks.rasterise }));
vi.mock('@/three/renderer/shared', () => ({
    onContextChange: (listener: (lost: boolean) => void) => {
        mocks.contextListener = listener;
        return mocks.unsubscribe;
    },
}));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));

import TeamScene3D from '@/components/scene3d/TeamScene3D.vue';
import CourtFloor from '@/components/court/CourtFloor.vue';

const COURT: CourtDesign = {
    version: 1,
    wood: 'honey',
    paint: '#0f5257',
    apron: '#0f5257',
    lines: '#f4f1e8',
    centerLogo: 'upload',
    baselineText: 'OWLS',
    sidelineText: '',
};

const canvas = (name: string) => Object.assign(document.createElement('canvas'), { id: name });

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

let wrapper: VueWrapper | null = null;
const mountScene = (props: Record<string, unknown> = {}) => {
    wrapper = mount(TeamScene3D, {
        props: { court: COURT, logoUrl: 'https://cdn/logo.png', drawingUrl: 'https://cdn/drawing.png', capacity: 18000, label: 'Owls court', ...props },
        attachTo: document.body,
    });
    return wrapper;
};
const scene = () => mocks.scenes[mocks.scenes.length - 1];

describe('TeamScene3D', () => {
    beforeEach(() => {
        mocks.scenes.length = 0;
        mocks.rasterise.mockReset();
        mocks.track.mockReset();
        mocks.unsubscribe.mockReset();
        mocks.contextListener = null;
        mocks.failToStart = false;
    });
    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
    });

    it('renders one button per preset and marks the active one', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        const buttons = w.findAll('button');
        expect(buttons.map((b) => b.text())).toEqual(['Team photo', 'Courtside', 'Broadcast', 'Rafters']);
        expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
    });

    it('clicking a preset sets it and tracks scene3d_preset', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        await w.findAll('button')[2].trigger('click');
        expect(scene().setPreset).toHaveBeenCalledWith('broadcast');
        expect(mocks.track).toHaveBeenCalledWith('scene3d_preset', { preset: 'broadcast' });
        expect(w.findAll('button')[2].attributes('aria-pressed')).toBe('true');
    });

    it('falls back to the court without its logo when the first rasterise fails', async () => {
        const second = canvas('second');
        mocks.rasterise.mockResolvedValueOnce(null).mockResolvedValueOnce(second);
        const w = mountScene();
        await flushPromises();
        expect(scene().setArena).toHaveBeenCalledWith(second, 18000);
        const floor = w.findComponent(CourtFloor);
        expect(floor.props('logoUrl')).toBeUndefined();
        expect(floor.props('drawingUrl')).toBe('https://cdn/drawing.png');
    });

    it('falls back to the court without its drawing when the logo was not the problem', async () => {
        const third = canvas('third');
        mocks.rasterise.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(third);
        const w = mountScene();
        await flushPromises();
        const floor = w.findComponent(CourtFloor);
        expect(floor.props('logoUrl')).toBeUndefined();
        expect(floor.props('drawingUrl')).toBeUndefined();
        expect(scene().setArena).toHaveBeenCalledWith(third, 18000);
    });

    it('gives the scene no court only when every attempt fails', async () => {
        mocks.rasterise.mockResolvedValue(null);
        mountScene();
        await flushPromises();
        expect(mocks.rasterise).toHaveBeenCalledTimes(3);
        expect(scene().setArena).toHaveBeenCalledWith(null, 18000);
    });

    it('a stale rasterise never lands', async () => {
        const first = deferred<HTMLCanvasElement | null>();
        const second = deferred<HTMLCanvasElement | null>();
        mocks.rasterise.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const w = mountScene();
        await flushPromises();
        await w.setProps({ court: { ...COURT, wood: 'walnut' } });
        await flushPromises();
        const newer = canvas('newer');
        second.resolve(newer);
        await flushPromises();
        first.resolve(canvas('older'));
        await flushPromises();
        expect(scene().setArena).toHaveBeenCalledTimes(1);
        expect(scene().setArena).toHaveBeenCalledWith(newer, 18000);
    });

    it('a rasterise finishing after unmount is dropped', async () => {
        const pending = deferred<HTMLCanvasElement | null>();
        mocks.rasterise.mockReturnValueOnce(pending.promise);
        const w = mountScene();
        await flushPromises();
        const created = scene();
        w.unmount();
        wrapper = null;
        pending.resolve(canvas('late'));
        await flushPromises();
        expect(created.setArena).not.toHaveBeenCalled();
    });

    it('uses the default court when court is null', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene({ court: null });
        await flushPromises();
        expect(w.findComponent(CourtFloor).props('court').centerLogo).toBe('none');
    });

    it('a context loss shows the paused message and emits failed', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        mocks.contextListener?.(true);
        await flushPromises();
        expect(w.text()).toContain('3D view paused');
        expect(w.emitted('failed')).toEqual([['context-lost']]);
        expect(mocks.track).toHaveBeenCalledWith('scene3d_failed', { reason: 'context-lost' });
        mocks.contextListener?.(false);
        await flushPromises();
        expect(w.text()).not.toContain('3D view paused');
        expect(scene().requestRender).toHaveBeenCalled();
    });

    it('a renderer that cannot start shows the unavailable card and tracks no-webgl', async () => {
        mocks.failToStart = true;
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        expect(w.text()).toContain("This browser can't show the 3D view.");
        expect(w.findAll('button')).toHaveLength(0);
        expect(mocks.track).toHaveBeenCalledWith('scene3d_failed', { reason: 'no-webgl' });
        expect(mocks.rasterise).not.toHaveBeenCalled();
    });

    it('unmount disposes the scene', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        const created = scene();
        w.unmount();
        wrapper = null;
        expect(created.dispose).toHaveBeenCalledTimes(1);
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    });
});
