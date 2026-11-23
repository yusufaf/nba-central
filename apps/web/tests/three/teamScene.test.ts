import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A WebGL-free stand-in for the shared renderer, so TeamScene can run in jsdom.
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
    acquireRenderer: vi.fn(),
    fitRenderer: vi.fn((renderer: { setSize: (w: number, h: number, s: boolean) => void }, w: number, h: number) =>
        renderer.setSize(w, h, false),
    ),
    stopPixelRatio: vi.fn(),
    pixelRatioListener: null as (() => void) | null,
}));
vi.mock('@/three/renderer/shared', () => ({
    getSharedRenderer: () => fakeRenderer,
    acquireRenderer: () => {
        shared.acquireRenderer();
        return fakeRenderer;
    },
    releaseRenderer: shared.releaseRenderer,
    fitRenderer: shared.fitRenderer,
    onPixelRatioChange: (listener: () => void) => {
        shared.pixelRatioListener = listener;
        return shared.stopPixelRatio;
    },
    disposeObject: shared.disposeObject,
}));

// People are a box each: the scene's placing, not the body, is under test.
const people = vi.hoisted(() => ({
    pending: [] as Array<() => void>,
    hold: false,
    failId: null as string | null,
    built: [] as import('three').Group[],
}));
vi.mock('@/three/character/person', async () => {
    const { Group, Mesh, BoxGeometry, MeshBasicMaterial } = await import('three');
    return {
        buildPerson: async (input: { id: string }) => {
            if (people.hold) await new Promise<void>((resolve) => people.pending.push(resolve));
            if (input.id === people.failId) throw new Error('bad body');
            const root = new Group();
            root.add(new Mesh(new BoxGeometry(0.5, 1.9, 0.3), new MeshBasicMaterial()));
            people.built.push(root);
            return { root, headHeight: 1.9 };
        },
    };
});

import type { Group } from 'three';
import type { VenueDesign } from '@/constants/venue';
import { ribbonTextureIn } from '@/three/arena/ribbon';
import { TeamScene } from '@/three/scene/teamScene';
import { framePreset } from '@/three/scene/cameraPresets';
import type { PersonInput } from '@/three/character/person';
import { HOME_KIT } from '@/utils/jerseyColours';

const KIT = { colours: HOME_KIT, teamName: 'Owls' };
const person = (id: string): PersonInput => ({ id, name: id, role: 'player', position: 'SF', heightInches: 79, weightPounds: 220 });
const peopleIn = (scene: TeamScene) => (scene as unknown as { peopleGroup: { children: unknown[] } }).peopleGroup.children.length;

type CameraLike = { position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }; aspect: number };
const cameraOf = (scene: TeamScene) => (scene as unknown as { camera: CameraLike }).camera;

let resizeCallback: (() => void) | null = null;
let container: HTMLDivElement;
let disconnects = 0;
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
            disconnect() {
                disconnects += 1;
            }
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
    it('a pixel ratio change re-fits the renderer (#300)', () => {
        const scene = new TeamScene(container);
        shared.fitRenderer.mockClear();
        shared.pixelRatioListener?.();
        expect(shared.fitRenderer).toHaveBeenCalledWith(fakeRenderer, width, height);
        scene.dispose();
    });

    it('a scene that fails partway through starting undoes everything it set up (#300)', () => {
        shared.acquireRenderer.mockClear();
        shared.releaseRenderer.mockClear();
        shared.stopPixelRatio.mockClear();
        disconnects = 0;
        shared.fitRenderer.mockImplementationOnce(() => {
            throw new Error('lost GPU');
        });
        expect(() => new TeamScene(container)).toThrow('lost GPU');
        expect(shared.acquireRenderer).toHaveBeenCalledTimes(1);
        expect(shared.releaseRenderer).toHaveBeenCalledTimes(1);
        expect(shared.stopPixelRatio).toHaveBeenCalledTimes(1);
        expect(disconnects).toBe(1);
        expect(fakeRenderer.domElement.parentElement).toBeNull();
    });

    it('dispose releases the renderer and the pixel-ratio watch once, even if called twice (#300)', () => {
        shared.releaseRenderer.mockClear();
        shared.stopPixelRatio.mockClear();
        const scene = new TeamScene(container);
        scene.dispose();
        scene.dispose();
        expect(shared.releaseRenderer).toHaveBeenCalledTimes(1);
        expect(shared.stopPixelRatio).toHaveBeenCalledTimes(1);
    });

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

    it('a failed build disposes the people that did build, and keeps the old ones (#304)', async () => {
        const scene = new TeamScene(container);
        await scene.setPeople([person('a')], KIT);
        people.failId = 'broken';
        people.built.length = 0;
        shared.disposeObject.mockClear();
        try {
            await expect(scene.setPeople([person('b'), person('broken'), person('c')], KIT)).rejects.toThrow('bad body');
            expect(people.built).toHaveLength(2);
            for (const root of people.built) expect(shared.disposeObject).toHaveBeenCalledWith(root);
            expect(peopleIn(scene)).toBe(2);
        } finally {
            people.failId = null;
            scene.dispose();
        }
    });

    it('a stale build that fails resolves quietly (#304)', async () => {
        const scene = new TeamScene(container);
        people.failId = 'broken';
        people.hold = true;
        try {
            const older = scene.setPeople([person('broken')], KIT);
            const newer = scene.setPeople([person('new1'), person('new2')], KIT);
            people.hold = false;
            people.pending.splice(0).forEach((resolve) => resolve());
            await expect(older).resolves.toBeUndefined();
            await newer;
            expect(peopleIn(scene)).toBe(4);
        } finally {
            people.failId = null;
            people.hold = false;
            scene.dispose();
        }
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

    it('a near-square view stands seven people in two rows', async () => {
        width = 712;
        height = 640;
        const scene = new TeamScene(container);
        await scene.setPeople(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(person), KIT);
        const group = (scene as unknown as { peopleGroup: { children: { name: string; position: { z: number } }[] } }).peopleGroup;
        const rows = new Set(group.children.filter((c) => c.name !== 'shadow').map((c) => c.position.z));
        expect(rows).toEqual(new Set([0.9, -0.7]));
        scene.dispose();
    });

    it('turning the view into two rows reframes the team photo', async () => {
        const scene = new TeamScene(container);
        await scene.setPeople(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(person), KIT);
        const camera = cameraOf(scene);
        camera.position.set(3, 4, 5);
        width = 712;
        height = 640;
        resizeCallback?.();
        const expected = framePreset('team', 712 / 640).position;
        expect(camera.position.x).toBeCloseTo(expected[0], 5);
        expect(camera.position.y).toBeCloseTo(expected[1], 5);
        expect(camera.position.z).toBeCloseTo(expected[2], 5);
        scene.dispose();
    });
});

describe('TeamScene arena parts (#295)', () => {
    const sceneOf = (scene: TeamScene) => (scene as unknown as { scene: Group }).scene;
    const bowls = (scene: TeamScene) => sceneOf(scene).children.filter((child) => child.name === 'seating');
    const courts = (scene: TeamScene) => sceneOf(scene).children.filter((child) => child.getObjectByName('court-floor'));
    const VENUE = { version: 1, seats: { primary: '#111111', secondary: '#eeeeee', pattern: 'rows' }, upperDeck: true } as const;

    beforeEach(() => shared.disposeObject.mockClear());

    it('setBowl swaps the bowl rather than adding another', () => {
        const scene = new TeamScene(container);
        scene.setBowl(18000, null);
        const [first] = bowls(scene);
        scene.setBowl(18000, VENUE);
        expect(bowls(scene)).toHaveLength(1);
        expect(bowls(scene)[0]).not.toBe(first);
        expect(shared.disposeObject).toHaveBeenCalledWith(first);
        scene.dispose();
    });

    it('setBowl relights the scene from the venue, in place (#298)', () => {
        const scene = new TeamScene(container);
        const stage = sceneOf(scene) as unknown as import('three').Scene;
        const spot = () => (stage.getObjectByName('spot') as import('three').SpotLight).intensity;
        scene.setBowl(18000, null);
        const count = stage.children.length;
        scene.setBowl(18000, { version: 1, lighting: { preset: 'theater', tint: '#a855f7' } });
        expect(spot()).toBeGreaterThan(0);
        expect((stage.background as import('three').Color).getHexString()).not.toBe('0b0d11');
        scene.setBowl(18000, null);
        expect(spot()).toBe(0);
        expect((stage.background as import('three').Color).getHexString()).toBe('0b0d11');
        expect(stage.children).toHaveLength(count);
        scene.dispose();
    });

    it('setCourt swaps the court rather than adding another', () => {
        const scene = new TeamScene(container);
        scene.setCourt(null);
        const [first] = courts(scene);
        scene.setCourt(null);
        expect(courts(scene)).toHaveLength(1);
        expect(shared.disposeObject).toHaveBeenCalledWith(first);
        scene.dispose();
    });

    it('adds nothing once disposed', () => {
        const scene = new TeamScene(container);
        scene.dispose();
        scene.setBowl(18000, VENUE);
        scene.setCourt(null);
        expect(bowls(scene)).toHaveLength(0);
        expect(courts(scene)).toHaveLength(0);
    });
});

describe('the LED ribbon scroll (#296)', () => {
    // Queued rAF: a self-rescheduling tick would recurse forever under the
    // file's synchronous stub.
    let queue: { id: number; cb: FrameRequestCallback }[] = [];
    let nextId = 1;
    const flush = (now: number) => {
        const due = queue;
        queue = [];
        for (const { cb } of due) cb(now);
    };

    beforeEach(() => {
        queue = [];
        nextId = 1;
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            queue.push({ id: nextId, cb });
            return nextId++;
        });
        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            queue = queue.filter((entry) => entry.id !== id);
        });
    });

    const RIBBON_VENUE = { version: 1, ribbon: { text: 'HELLO', color: '#f59e0b' } } as const;
    const tickOf = (scene: TeamScene) => (scene as unknown as { tick: FrameRequestCallback }).tick;
    const loopCallbacks = (scene: TeamScene) => queue.filter(({ cb }) => cb === tickOf(scene));
    const ribbonOf = (scene: TeamScene) => ribbonTextureIn((scene as unknown as { bowl: Group }).bowl)!;

    // Builds the scene and its bowl, then drains their on-demand renders.
    const setUp = (venue: VenueDesign | null = RIBBON_VENUE) => {
        const scene = new TeamScene(container);
        scene.setBowl(18000, venue);
        flush(0);
        return scene;
    };

    it('queues one loop when motion is on, seeds from the first tick and draws at ~30 fps', () => {
        const scene = setUp();
        const renders = scene.renderCount;
        scene.setMotion(true);
        expect(loopCallbacks(scene)).toHaveLength(1);
        flush(1000);
        expect(scene.renderCount).toBe(renders);
        flush(1010);
        flush(1020);
        expect(scene.renderCount).toBe(renders);
        flush(1033);
        expect(scene.renderCount).toBe(renders + 1);
        expect(ribbonOf(scene).offset.x).toBeCloseTo((0.033 * 2) / 19.2, 6);
        expect(loopCallbacks(scene)).toHaveLength(1);
    });

    it('keeps the label anchors across scroll frames', () => {
        const scene = setUp();
        const anchors = scene.labelAnchors();
        scene.setMotion(true);
        flush(1000);
        flush(1040);
        flush(1080);
        expect(scene.labelAnchors()).toBe(anchors);
    });

    it('keeps one loop across bowl rebuilds, scrolling the newest ribbon', () => {
        const scene = setUp();
        scene.setMotion(true);
        scene.setBowl(18000, { version: 1, ribbon: { text: 'A', color: '#ffffff' } });
        scene.setBowl(18000, { version: 1, ribbon: { text: 'B', color: '#ffffff' } });
        expect(loopCallbacks(scene)).toHaveLength(1);
        flush(1000);
        flush(1040);
        expect(ribbonOf(scene).offset.x).toBeGreaterThan(0);
    });

    it("carries the ribbon's place to a rebuilt bowl", () => {
        const scene = setUp();
        scene.setMotion(true);
        flush(1000);
        flush(1040);
        flush(1080);
        const offset = ribbonOf(scene).offset.x;
        expect(offset).toBeGreaterThan(0);
        scene.setBowl(18000, { version: 1, ribbon: { text: 'NEW TEXT', color: '#ffffff' } });
        expect(ribbonOf(scene).offset.x).toBe(offset);
    });

    it('keeps one loop when motion goes off and on before a frame', () => {
        const scene = setUp();
        scene.setMotion(true);
        scene.setMotion(false);
        scene.setMotion(true);
        expect(loopCallbacks(scene)).toHaveLength(1);
    });

    it('stops with the text at rest, drawing it once', () => {
        const scene = setUp();
        scene.setMotion(true);
        flush(1000);
        flush(1040);
        expect(ribbonOf(scene).offset.x).toBeGreaterThan(0);
        scene.setMotion(false);
        expect(loopCallbacks(scene)).toHaveLength(0);
        expect(ribbonOf(scene).offset.x).toBe(0);
        const renders = scene.renderCount;
        flush(1100);
        expect(scene.renderCount).toBe(renders + 1);
    });

    it('stops when the new bowl has no ribbon', () => {
        const scene = setUp();
        scene.setMotion(true);
        scene.setBowl(18000, null);
        expect(loopCallbacks(scene)).toHaveLength(0);
    });

    it('never loops without a ribbon', () => {
        const scene = setUp(null);
        scene.setMotion(true);
        expect(loopCallbacks(scene)).toHaveLength(0);
        const seatsOnly = setUp({ version: 1, seats: { primary: '#111111', secondary: '#222222', pattern: 'solid' }, upperDeck: false });
        seatsOnly.setMotion(true);
        expect(loopCallbacks(seatsOnly)).toHaveLength(0);
    });

    it('stops the loop on dispose', () => {
        const scene = setUp();
        scene.setMotion(true);
        scene.dispose();
        expect(loopCallbacks(scene)).toHaveLength(0);
    });
});
