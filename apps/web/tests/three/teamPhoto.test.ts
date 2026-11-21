import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Camera, Group, Scene } from 'three';

const fakeRenderer = vi.hoisted(() => ({ capabilities: { getMaxAnisotropy: () => 1 } }));
const shared = vi.hoisted(() => ({ disposeObject: vi.fn() }));
vi.mock('@/three/renderer/shared', () => ({
    getSharedRenderer: () => fakeRenderer,
    disposeObject: shared.disposeObject,
}));

const offscreen = vi.hoisted(() => ({
    renderToImageData: vi.fn((..._args: unknown[]) => ({ width: 1200, height: 630, data: new Uint8ClampedArray(4) })),
}));
vi.mock('@/three/renderer/offscreen', () => offscreen);

const people = vi.hoisted(() => ({ failId: null as string | null, built: [] as Group[] }));
vi.mock('@/three/character/person', async () => {
    const { Group } = await import('three');
    return {
        buildPerson: async ({ id }: { id: string }) => {
            if (id === people.failId) throw new Error('no body');
            const root = new Group();
            root.name = id;
            people.built.push(root);
            return { root, headHeight: 1.9 };
        },
    };
});

const stage = vi.hoisted(() => ({ failArena: false, arenaArgs: [] as unknown[][] }));
vi.mock('@/three/scene/stage', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/three/scene/stage')>();
    return {
        ...actual,
        buildArena: (...args: Parameters<typeof actual.buildArena>) => {
            stage.arenaArgs.push(args);
            if (stage.failArena) throw new Error('no arena');
            return actual.buildArena(...args);
        },
    };
});

import { CARD_SIZE, renderTeamPhotoFrame } from '@/three/scene/teamPhoto';
import { framePreset } from '@/three/scene/cameraPresets';
import { HOME_KIT } from '@/utils/jerseyColours';
import type { PersonInput } from '@/three/character/person';

const person = (id: string): PersonInput => ({ id, name: id, role: 'player', heightInches: 79, weightPounds: 220 });
const input = (ids: string[]) => ({
    court: null,
    capacity: 18000,
    venue: null,
    people: ids.map(person),
    kit: { colours: HOME_KIT, teamName: 'Owls' },
});

const putImageData = vi.fn();

beforeEach(() => {
    // Only the card canvas gets a context; the shadows' canvases draw nothing.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        return (this.width === 1200 ? { putImageData } : null) as never;
    });
    offscreen.renderToImageData.mockClear();
    shared.disposeObject.mockClear();
    people.failId = null;
    stage.failArena = false;
    stage.arenaArgs = [];
    people.built = [];
});

afterEach(() => {
    vi.restoreAllMocks();
});

const rendered = () => offscreen.renderToImageData.mock.calls[0] as unknown as [unknown, Scene, Camera & { fov: number; aspect: number }, number, number];

describe('renderTeamPhotoFrame', () => {
    it('draws everyone in one row onto a card-sized canvas', async () => {
        const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'coach', 'gm'];
        const canvas = await renderTeamPhotoFrame(input(ids));
        expect(canvas.width).toBe(CARD_SIZE.width);
        expect(canvas.height).toBe(CARD_SIZE.height);
        expect(putImageData).toHaveBeenCalledOnce();
        const [renderer, , , width, height] = rendered();
        expect(renderer).toBe(fakeRenderer);
        expect([width, height]).toEqual([1200, 630]);
        expect(new Set(people.built.map((root) => root.position.z.toFixed(2))).size).toBeLessThanOrEqual(2);
        const xs = people.built.map((root) => root.position.x);
        expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });

    it("builds the arena with the team's venue", async () => {
        const venue = { version: 1, seats: { primary: '#111111', secondary: '#eeeeee', pattern: 'sections' }, upperDeck: false } as const;
        await renderTeamPhotoFrame({ ...input(['p1']), venue });
        expect(stage.arenaArgs).toHaveLength(1);
        expect(stage.arenaArgs[0][1]).toBe(18000);
        expect(stage.arenaArgs[0][3]).toEqual(venue);
    });

    it("lights the card from the team's venue (#298)", async () => {
        const spotIn = (scene: Scene) => (scene.getObjectByName('spot') as unknown as { intensity: number }).intensity;
        await renderTeamPhotoFrame({ ...input(['p1']), venue: { version: 1, lighting: { preset: 'theater', tint: '#ffffff' } } });
        expect(spotIn(rendered()[1])).toBeGreaterThan(0);
        offscreen.renderToImageData.mockClear();
        await renderTeamPhotoFrame(input(['p1']));
        expect(spotIn(rendered()[1])).toBe(0);
    });

    it("frames the team-photo shot for the card's shape", async () => {
        await renderTeamPhotoFrame(input(['p1']));
        const camera = rendered()[2];
        const expected = framePreset('team', 1200 / 630);
        expect(camera.fov).toBe(expected.fov);
        expect(camera.aspect).toBeCloseTo(1200 / 630);
        expect(camera.position.toArray()).toEqual(expected.position);
    });

    it('disposes the scene after a render, and after a failed one', async () => {
        await renderTeamPhotoFrame(input(['p1']));
        const scene = rendered()[1];
        expect(shared.disposeObject).toHaveBeenCalledWith(scene);

        shared.disposeObject.mockClear();
        offscreen.renderToImageData.mockImplementationOnce(() => {
            throw new Error('lost');
        });
        await expect(renderTeamPhotoFrame(input(['p1']))).rejects.toThrow('lost');
        expect(shared.disposeObject).toHaveBeenCalled();
    });

    it('disposes the people already built when one fails', async () => {
        people.failId = 'p2';
        await expect(renderTeamPhotoFrame(input(['p1', 'p2', 'p3']))).rejects.toThrow('no body');
        for (const root of people.built) expect(shared.disposeObject).toHaveBeenCalledWith(root);
        expect(offscreen.renderToImageData).not.toHaveBeenCalled();
    });

    it('disposes everyone built when the arena fails', async () => {
        stage.failArena = true;
        await expect(renderTeamPhotoFrame(input(['p1', 'p2']))).rejects.toThrow('no arena');
        // The scene is disposed, with everyone in it.
        expect(shared.disposeObject).toHaveBeenCalledOnce();
        const [scene] = shared.disposeObject.mock.calls[0] as [Group];
        for (const root of people.built) expect(scene.getObjectById(root.id)).toBe(root);
    });
});
