import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A WebGL-free stand-in for the shared renderer, so TeamScene can run in jsdom.
const fakeRenderer = vi.hoisted(() => ({
    domElement: null as unknown as HTMLCanvasElement,
    setSize: vi.fn(),
    render: vi.fn(),
    capabilities: { getMaxAnisotropy: () => 1 },
    info: { memory: { geometries: 0, textures: 0 } },
}));
vi.mock('@/three/renderer/shared', () => ({
    getSharedRenderer: () => fakeRenderer,
    disposeObject: vi.fn(),
}));

import { TeamScene } from '@/three/scene/teamScene';

type CameraLike = { position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }; aspect: number };
const cameraOf = (scene: TeamScene) => (scene as unknown as { camera: CameraLike }).camera;

let resizeCallback: (() => void) | null = null;
let container: HTMLDivElement;
let width = 1280;
let height = 720;

beforeEach(() => {
    fakeRenderer.domElement = document.createElement('canvas');
    vi.stubGlobal(
        'ResizeObserver',
        class {
            constructor(callback: () => void) {
                resizeCallback = callback;
            }
            observe() {}
            disconnect() {}
        },
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
    });
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { get: () => width });
    Object.defineProperty(container, 'clientHeight', { get: () => height });
    document.body.appendChild(container);
});

afterEach(() => {
    vi.unstubAllGlobals();
    container.remove();
    width = 1280;
    height = 720;
});

describe('TeamScene', () => {
    it("a resize keeps the user's orbit and only updates the aspect", () => {
        const scene = new TeamScene(container);
        const camera = cameraOf(scene);
        camera.position.set(3, 4, 5);
        width = 1280;
        height = 600;
        resizeCallback?.();
        expect([camera.position.x, camera.position.y, camera.position.z]).toEqual([3, 4, 5]);
        expect(camera.aspect).toBeCloseTo(1280 / 600, 5);
        scene.dispose();
    });

    it('choosing a preset still moves the camera', () => {
        const scene = new TeamScene(container);
        const camera = cameraOf(scene);
        camera.position.set(3, 4, 5);
        scene.setPreset('rafters');
        expect(camera.position.y).toBeCloseTo(30, 5);
        scene.dispose();
    });

    it("dispose leaves the canvas alone once another scene has taken it", () => {
        const first = new TeamScene(container);
        const other = document.createElement('div');
        document.body.appendChild(other);
        other.appendChild(fakeRenderer.domElement);
        first.dispose();
        expect(fakeRenderer.domElement.parentElement).toBe(other);
        other.remove();
    });

    it('dispose removes the canvas from its own container', () => {
        const scene = new TeamScene(container);
        scene.dispose();
        expect(fakeRenderer.domElement.parentElement).toBeNull();
    });
});
