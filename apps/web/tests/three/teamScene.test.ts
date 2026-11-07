import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A WebGL-free stand-in for the shared renderer, so TeamScene can run in jsdom.
const fakeRenderer = vi.hoisted(() => ({
    domElement: null as unknown as HTMLCanvasElement,
    setSize: vi.fn(),
    render: vi.fn(),
    capabilities: { getMaxAnisotropy: () => 1 },
    info: { memory: { geometries: 0, textures: 0 } },
}));
const shared = vi.hoisted(() => ({ disposeObject: vi.fn() }));
vi.mock('@/three/renderer/shared', () => ({
    getSharedRenderer: () => fakeRenderer,
    disposeObject: shared.disposeObject,
}));

// People are a box each: the scene's placing, not the body, is under test.
const people = vi.hoisted(() => ({ pending: [] as Array<() => void>, hold: false }));
vi.mock('@/three/character/person', async () => {
    const { Group, Mesh, BoxGeometry, MeshBasicMaterial } = await import('three');
    return {
        buildPerson: async () => {
            if (people.hold) await new Promise<void>((resolve) => people.pending.push(resolve));
            const root = new Group();
            root.add(new Mesh(new BoxGeometry(0.5, 1.9, 0.3), new MeshBasicMaterial()));
            return { root, headHeight: 1.9 };
        },
    };
});

import { TeamScene } from '@/three/scene/teamScene';
import type { PersonInput } from '@/three/character/person';
import { HOME_KIT } from '@/three/character/jerseyColours';

const KIT = { colours: HOME_KIT, teamName: 'Owls' };
const person = (id: string): PersonInput => ({ id, name: id, role: 'player', position: 'SF', heightInches: 79, weightPounds: 220 });
const peopleIn = (scene: TeamScene) => (scene as unknown as { peopleGroup: { children: unknown[] } }).peopleGroup.children.length;

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

    it('setPeople adds one person and one shadow per input', async () => {
        const scene = new TeamScene(container);
        await scene.setPeople([person('a'), person('b'), person('c')], KIT);
        expect(peopleIn(scene)).toBe(6);
        scene.dispose();
    });

    it('a newer setPeople wins and the older one is disposed, not added', async () => {
        const scene = new TeamScene(container);
        people.hold = true;
        const older = scene.setPeople([person('old')], KIT);
        const newer = scene.setPeople([person('new1'), person('new2')], KIT);
        people.hold = false;
        people.pending.splice(0).reverse().forEach((resolve) => resolve());
        await Promise.all([older, newer]);
        expect(peopleIn(scene)).toBe(4);
        expect(shared.disposeObject).toHaveBeenCalled();
        scene.dispose();
    });

    it('labelAnchors projects heads into the container', async () => {
        const scene = new TeamScene(container);
        await scene.setPeople([person('a'), person('b')], KIT);
        const anchors = scene.labelAnchors();
        expect(anchors.map((a) => a.id)).toEqual(['a', 'b']);
        for (const anchor of anchors) {
            expect(anchor.visible).toBe(true);
            expect(anchor.x).toBeGreaterThanOrEqual(0);
            expect(anchor.x).toBeLessThanOrEqual(width);
            expect(anchor.y).toBeGreaterThanOrEqual(0);
        }
        scene.dispose();
    });
});
