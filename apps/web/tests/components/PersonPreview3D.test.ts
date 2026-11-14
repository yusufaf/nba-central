import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { PersonInput } from '@/three/character/person';
import { DEFAULT_APPEARANCE } from '@/utils/appearance';

const mocks = vi.hoisted(() => ({
    previews: [] as Array<{
        setPerson: ReturnType<typeof vi.fn>;
        rotate: ReturnType<typeof vi.fn>;
        resetView: ReturnType<typeof vi.fn>;
        requestRender: ReturnType<typeof vi.fn>;
        dispose: ReturnType<typeof vi.fn>;
        renderCount: number;
        onRender: (() => void) | null;
        onError: (() => void) | null;
        onShown: (() => void) | null;
    }>,
    track: vi.fn(),
    contextListener: null as ((lost: boolean) => void) | null,
    unsubscribe: vi.fn(),
    failToStart: false,
}));

vi.mock('@/three/scene/personPreview', () => ({
    PersonPreview: class {
        setPerson = vi.fn();
        rotate = vi.fn();
        resetView = vi.fn();
        requestRender = vi.fn();
        dispose = vi.fn();
        renderCount = 0;
        onRender: (() => void) | null = null;
        onError: (() => void) | null = null;
        onShown: (() => void) | null = null;
        constructor() {
            if (mocks.failToStart) throw new Error('Error creating WebGL context.');
            mocks.previews.push(this);
        }
    },
}));
vi.mock('@/three/renderer/shared', () => ({
    onContextChange: (listener: (lost: boolean) => void) => {
        mocks.contextListener = listener;
        return mocks.unsubscribe;
    },
}));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));

import PersonPreview3D from '@/components/scene3d/PersonPreview3D.vue';
import Scene3DUnavailable from '@/components/scene3d/Scene3DUnavailable.vue';

const PERSON: PersonInput = {
    id: 'preview',
    name: '',
    role: 'player',
    position: 'SG',
    heightInches: 78,
    weightPounds: 200,
    appearance: structuredClone(DEFAULT_APPEARANCE),
};

let wrapper: VueWrapper | null = null;
const mountPreview = (person: PersonInput = structuredClone(PERSON)) => {
    wrapper = mount(PersonPreview3D, { props: { person, label: '3D preview of Nova' }, attachTo: document.body });
    return wrapper;
};

beforeEach(() => {
    mocks.previews.length = 0;
    mocks.failToStart = false;
    mocks.track.mockClear();
});
afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

describe('PersonPreview3D', () => {
    it('builds the person on mount and again on a deep change', async () => {
        const w = mountPreview();
        const [preview] = mocks.previews;
        expect(preview.setPerson).toHaveBeenCalledTimes(1);
        expect(preview.setPerson.mock.calls[0][0]).toMatchObject({ heightInches: 78 });

        const next = structuredClone(PERSON);
        next.appearance!.hair.style = 'parted';
        await w.setProps({ person: next });
        await flushPromises();
        expect(preview.setPerson).toHaveBeenCalledTimes(2);
        expect(preview.setPerson.mock.calls[1][0].appearance.hair.style).toBe('parted');
    });

    it('labels the canvas and reports frames', async () => {
        const w = mountPreview();
        const host = w.get('[role="img"]');
        expect(host.attributes('aria-label')).toBe('3D preview of Nova');
        mocks.previews[0].renderCount = 3;
        mocks.previews[0].onRender?.();
        await flushPromises();
        expect(host.attributes('data-render-count')).toBe('3');
    });

    it('rotates and resets from its buttons', async () => {
        const w = mountPreview();
        const [preview] = mocks.previews;
        await w.get('button[aria-label="Rotate left"]').trigger('click');
        await w.get('button[aria-label="Rotate right"]').trigger('click');
        await w.get('button[aria-label="Reset view"]').trigger('click');
        expect(preview.rotate.mock.calls).toEqual([[-Math.PI / 8], [Math.PI / 8]]);
        expect(preview.resetView).toHaveBeenCalledTimes(1);
    });

    it("shows the unavailable note when WebGL can't start", async () => {
        mocks.failToStart = true;
        const w = mountPreview();
        await flushPromises();
        expect(w.findComponent(Scene3DUnavailable).exists()).toBe(true);
        expect(mocks.track).toHaveBeenCalledWith('scene3d_failed', { reason: 'no-webgl', page: 'creator' });
    });

    it('pauses on a lost context and emits failed', async () => {
        const w = mountPreview();
        mocks.contextListener?.(true);
        await flushPromises();
        expect(w.text()).toContain('3D view paused');
        expect(w.emitted('failed')?.[0]).toEqual(['context-lost']);
        mocks.contextListener?.(false);
        await flushPromises();
        expect(w.text()).not.toContain('3D view paused');
    });

    it('says when a build fails, until one lands', async () => {
        const w = mountPreview();
        mocks.previews[0].onError?.();
        await flushPromises();
        expect(w.text()).toContain("The preview couldn't show this look");
        expect(w.emitted('failed')?.[0]).toEqual(['build']);
        mocks.previews[0].onShown?.();
        await flushPromises();
        expect(w.text()).not.toContain("The preview couldn't show this look");
    });

    it('disposes the preview on unmount', () => {
        const w = mountPreview();
        const [preview] = mocks.previews;
        w.unmount();
        wrapper = null;
        expect(preview.dispose).toHaveBeenCalledTimes(1);
        expect(mocks.unsubscribe).toHaveBeenCalled();
    });
});
