import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Group } from 'three';

const fakeRenderer = vi.hoisted(() => ({
    domElement: null as unknown as HTMLCanvasElement,
    setSize: vi.fn(),
    render: vi.fn(),
    capabilities: { getMaxAnisotropy: () => 1 },
    info: { memory: { geometries: 0, textures: 0 } },
}));
const shared = vi.hoisted(() => ({
    disposeObject: vi.fn(),
    releaseRenderer: vi.fn(),
    fitRenderer: vi.fn((renderer: { setSize: (w: number, h: number, s: boolean) => void }, w: number, h: number) =>
        renderer.setSize(w, h, false),
    ),
    stopPixelRatio: vi.fn(),
    pixelRatioListener: null as (() => void) | null,
}));
vi.mock('@/three/renderer/shared', () => ({
    getSharedRenderer: () => fakeRenderer,
    acquireRenderer: () => fakeRenderer,
    releaseRenderer: shared.releaseRenderer,
    fitRenderer: shared.fitRenderer,
    onPixelRatioChange: (listener: () => void) => {
        shared.pixelRatioListener = listener;
        return shared.stopPixelRatio;
    },
    disposeObject: shared.disposeObject,
}));

// Each build waits until the test settles it, so the queue can be observed.
const builds = vi.hoisted(() => ({
    calls: [] as { id: string; height: number; resolve: () => void; reject: (error: Error) => void; root?: Group }[],
}));
vi.mock('@/three/character/person', async () => {
    const { Group } = await import('three');
    return {
        buildPerson: (input: { id: string; heightInches: number }) =>
            new Promise((resolve, reject) => {
                const root = new Group();
                root.name = input.id;
                const height = input.heightInches * 0.0254;
                builds.calls.push({ id: input.id, height, resolve: () => resolve({ root, headHeight: height }), reject, root });
            }),
    };
});

import { PersonPreview } from '@/three/scene/personPreview';
import { framePerson } from '@/three/scene/cameraPresets';
import type { PersonInput } from '@/three/character/person';
import { HOME_KIT } from '@/utils/jerseyColours';

const KIT = { colours: HOME_KIT, teamName: '' };
const person = (id: string, heightInches = 78): PersonInput => ({ id, name: '', role: 'player', heightInches, weightPounds: 200 });
const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};
const shown = (preview: PersonPreview) => (preview as unknown as { person: Group | null }).person;
type CameraLike = { position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void } };
const cameraOf = (preview: PersonPreview) => (preview as unknown as { camera: CameraLike }).camera;

let container: HTMLDivElement;

beforeEach(() => {
    builds.calls.length = 0;
    shared.disposeObject.mockClear();
    fakeRenderer.domElement = document.createElement('canvas');
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        },
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
    });
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { get: () => 400 });
    Object.defineProperty(container, 'clientHeight', { get: () => 400 });
    document.body.appendChild(container);
});

afterEach(() => {
    vi.unstubAllGlobals();
    container.remove();
});

describe('PersonPreview', () => {
    it('a pixel ratio change re-fits the renderer (#300)', () => {
        const preview = new PersonPreview(container);
        shared.fitRenderer.mockClear();
        shared.pixelRatioListener?.();
        expect(shared.fitRenderer).toHaveBeenCalledWith(fakeRenderer, 400, 400);
        preview.dispose();
    });

    it('dispose releases the renderer and the pixel-ratio watch once, even if called twice (#300)', () => {
        shared.releaseRenderer.mockClear();
        shared.stopPixelRatio.mockClear();
        const preview = new PersonPreview(container);
        preview.dispose();
        preview.dispose();
        expect(shared.releaseRenderer).toHaveBeenCalledTimes(1);
        expect(shared.stopPixelRatio).toHaveBeenCalledTimes(1);
    });

    it("uses the arena's standard lighting (#298)", async () => {
        const { lightingRig } = await import('@/three/arena/lighting');
        const { DEFAULT_LIGHTING } = await import('@/utils/venue');
        const { Color } = await import('three');
        const preview = new PersonPreview(container);
        const scene = (preview as unknown as { scene: import('three').Scene }).scene;
        const rig = lightingRig(DEFAULT_LIGHTING);
        const hemisphere = scene.getObjectByName('hemisphere') as import('three').HemisphereLight;
        const key = scene.getObjectByName('key') as import('three').DirectionalLight;
        const spot = scene.getObjectByName('spot') as import('three').SpotLight;
        expect(hemisphere.color.equals(new Color(rig.hemisphere.sky))).toBe(true);
        expect(hemisphere.groundColor.equals(new Color(rig.hemisphere.ground))).toBe(true);
        expect(hemisphere.intensity).toBe(rig.hemisphere.intensity);
        expect(key.intensity).toBe(rig.key.intensity);
        expect(key.position.toArray()).toEqual(rig.key.position);
        expect(spot.intensity).toBe(0);
        expect((scene.background as import('three').Color).equals(new Color(rig.background))).toBe(true);
        preview.dispose();
    });

    it('builds the first edit and only the latest one queued behind it', async () => {
        const preview = new PersonPreview(container);
        preview.setPerson(person('a'), KIT);
        preview.setPerson(person('b'), KIT);
        preview.setPerson(person('c'), KIT);
        expect(builds.calls.map((c) => c.id)).toEqual(['a']);

        builds.calls[0].resolve();
        await settle();
        expect(builds.calls.map((c) => c.id)).toEqual(['a', 'c']);
        builds.calls[1].resolve();
        await settle();
        expect(shown(preview)?.name).toBe('c');
        // The one it replaced is freed.
        expect(shared.disposeObject).toHaveBeenCalledWith(builds.calls[0].root);
    });

    it('keeps the previous person when a build fails, then builds the queued one', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const preview = new PersonPreview(container);
        const onError = vi.fn();
        const onShown = vi.fn();
        preview.onError = onError;
        preview.onShown = onShown;
        preview.setPerson(person('a'), KIT);
        builds.calls[0].resolve();
        await settle();

        preview.setPerson(person('b'), KIT);
        preview.setPerson(person('c'), KIT);
        builds.calls[1].reject(new Error('offline'));
        await settle();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onShown).toHaveBeenCalledTimes(1);
        expect(shown(preview)?.name).toBe('a');
        expect(builds.calls.map((c) => c.id)).toEqual(['a', 'b', 'c']);
        error.mockRestore();
    });

    it('re-frames for a new height but keeps the orbit otherwise', async () => {
        const preview = new PersonPreview(container);
        const camera = cameraOf(preview);
        preview.setPerson(person('a', 78), KIT);
        builds.calls[0].resolve();
        await settle();
        expect(camera.position.z).toBeCloseTo(framePerson(78 * 0.0254, 1).position[2]);

        camera.position.set(3, 2, 1);
        preview.setPerson(person('b', 78), KIT);
        builds.calls[1].resolve();
        await settle();
        expect([camera.position.x, camera.position.y, camera.position.z]).toEqual([3, 2, 1]);

        preview.setPerson(person('c', 84), KIT);
        builds.calls[2].resolve();
        await settle();
        expect(camera.position.z).toBeCloseTo(framePerson(84 * 0.0254, 1).position[2]);
    });

    it('rotates around the person at the same distance, and resets', async () => {
        const preview = new PersonPreview(container);
        preview.setPerson(person('a'), KIT);
        builds.calls[0].resolve();
        await settle();
        const camera = cameraOf(preview);
        const before = { ...camera.position };
        const target = framePerson(78 * 0.0254, 1).target;
        const reach = (p: { x: number; z: number }) => Math.hypot(p.x - target[0], p.z - target[2]);

        preview.rotate(Math.PI / 2);
        expect(Math.abs(camera.position.x)).toBeGreaterThan(1);
        expect(reach(camera.position)).toBeCloseTo(reach(before), 4);

        preview.resetView();
        expect(camera.position.x).toBeCloseTo(0, 6);
        expect(camera.position.z).toBeCloseTo(before.z, 6);
    });

    it('frees a build that lands after dispose', async () => {
        const preview = new PersonPreview(container);
        preview.setPerson(person('a'), KIT);
        preview.dispose();
        builds.calls[0].resolve();
        await settle();
        expect(shared.disposeObject).toHaveBeenCalledWith(builds.calls[0].root);
        expect(shown(preview)).toBeNull();
    });

    it('counts rendered frames', async () => {
        const preview = new PersonPreview(container);
        const onRender = vi.fn();
        preview.onRender = onRender;
        preview.setPerson(person('a'), KIT);
        builds.calls[0].resolve();
        await settle();
        expect(preview.renderCount).toBeGreaterThan(0);
        expect(onRender).toHaveBeenCalled();
    });
});
