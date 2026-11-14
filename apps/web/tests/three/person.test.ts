import { describe, expect, it, vi } from 'vitest';
import { Group, MeshStandardMaterial, SkinnedMesh, Vector3 } from 'three';
import type { Landmarks } from '@/three/character/kit';
import { skeletonBody } from './fixtures/skeleton';
import type { PersonAppearance } from '@/constants/appearance';

const mocks = vi.hoisted(() => ({
    landmarks: [] as Landmarks[],
    kitTexture: vi.fn(() => null),
    kitOptions: [] as { vinyl: string | null; material: MeshStandardMaterial }[],
    failHair: false,
    urls: [] as string[],
}));

vi.mock('@/three/character/load', async (original) => ({
    ...(await original<typeof import('@/three/character/load')>()),
    loadBody: async (url: string) => {
        mocks.urls.push(url);
        if (url.includes('/hair/') && mocks.failHair) throw new Error('offline');
        return skeletonBody();
    },
}));
vi.mock('@/three/character/kit', async (original) => {
    const actual = await original<typeof import('@/three/character/kit')>();
    return {
        ...actual,
        kitTexture: mocks.kitTexture,
        applyKitMaterial: (material: MeshStandardMaterial, options: { landmarks: Landmarks; vinyl: string | null }) => {
            mocks.landmarks.push(options.landmarks);
            mocks.kitOptions.push({ vinyl: options.vinyl, material });
            return material;
        },
    };
});

import { buildPerson } from '@/three/character/person';
import { findLandmarks } from '@/three/character/kit';
import { reshapeBody } from '@/three/character/reshape';

const meshIn = (root: Group) => root.children.find((c): c is SkinnedMesh => (c as SkinnedMesh).isSkinnedMesh)!;

describe('buildPerson', () => {
    it('paints the kit against the reshaped body, not the stock one', async () => {
        const heavy = { id: 'c', name: 'C', role: 'player' as const, position: 'C', heightInches: 84, weightPounds: 290 };
        mocks.landmarks.length = 0;
        await buildPerson(heavy, { colours: { primary: '#123456', secondary: '#ffffff', trim: '#ffffff' }, teamName: 'Owls' });

        const stock = skeletonBody();
        const before = findLandmarks(meshIn(stock));
        const { girthFor, bodySize } = await import('@/three/character/body');
        reshapeBody(stock, { girth: girthFor(bodySize(heavy)), shoulders: 1, wingspan: 1.03 });
        stock.updateMatrixWorld(true);
        const after = findLandmarks(meshIn(stock));

        expect(after.shoulderX).not.toBeCloseTo(before.shoulderX, 3);
        expect(mocks.landmarks[0].shoulderX).toBeCloseTo(after.shoulderX, 5);
        expect(mocks.landmarks[0].frontZ).toBeCloseTo(after.frontZ, 5);
    });

    it("passes the person's number to the kit texture", async () => {
        mocks.kitTexture.mockClear();
        const kit = { colours: { primary: '#123456', secondary: '#ffffff', trim: '#ffffff' }, teamName: 'Owls' };
        await buildPerson({ id: 'a', name: 'A', role: 'player', heightInches: 78, weightPounds: 210, number: '00' }, kit);
        await buildPerson({ id: 'b', name: 'B', role: 'player', heightInches: 78, weightPounds: 210 }, kit);
        expect(mocks.kitTexture.mock.calls.map(([options]) => (options as { number: unknown }).number)).toEqual(['00', null]);
    });

    describe('with an appearance', () => {
        const KIT = { colours: { primary: '#123456', secondary: '#ffffff', trim: '#ffffff' }, teamName: 'Owls' };
        const LOOK: PersonAppearance = {
            version: 1,
            frame: 'm',
            skin: '#f1c7a5',
            hair: { style: 'parted', color: '#3b2a1e' },
            facialHair: { style: 'beard', color: '#aa5500' },
            build: { girth: 0, shoulders: 0, wingspan: 0 },
            accessories: [],
            pose: 'relaxed',
        };
        const person = { id: 'n', name: 'Nova', role: 'player' as const, heightInches: 75, weightPounds: 195 };
        const named = (root: Group, name: string) => root.getObjectByName(name) as SkinnedMesh | undefined;

        it('adds hair and a beard in their colours', async () => {
            mocks.failHair = false;
            const { root } = await buildPerson({ ...person, appearance: LOOK }, KIT);
            const hair = named(root, 'hair');
            const beard = named(root, 'facialHair');
            expect(hair?.isSkinnedMesh).toBe(true);
            expect((hair!.material as MeshStandardMaterial).color.getHexString()).toBe('3b2a1e');
            expect((beard!.material as MeshStandardMaterial).color.getHexString()).toBe('aa5500');
        });

        it('paints the skin colour with no vinyl', async () => {
            mocks.kitOptions.length = 0;
            await buildPerson({ ...person, appearance: LOOK }, KIT);
            const [{ vinyl, material }] = mocks.kitOptions;
            expect(vinyl).toBeNull();
            expect(material.map).toBeNull();
            expect(material.color.getHexString()).toBe('f1c7a5');
        });

        it('leaves a person without one a vinyl figurine', async () => {
            mocks.kitOptions.length = 0;
            const { root } = await buildPerson(person, KIT);
            expect(mocks.kitOptions[0].vinyl).toBe('#c8c3ba');
            expect(named(root, 'hair')).toBeUndefined();
        });

        it('loads the female body for frame f, and the male one for a figurine', async () => {
            mocks.urls.length = 0;
            await buildPerson({ ...person, appearance: { ...LOOK, frame: 'f', hair: { style: 'long', color: '#000000' }, facialHair: { style: 'none', color: '#000000' } } }, KIT);
            expect(mocks.urls.some((url) => url.includes('athletic-female'))).toBe(true);
            expect(mocks.urls.some((url) => url.includes('athletic-male'))).toBe(false);
            expect(mocks.urls.some((url) => url.includes('/hair/long'))).toBe(true);

            mocks.urls.length = 0;
            await buildPerson(person, KIT);
            expect(mocks.urls).toHaveLength(1);
            expect(mocks.urls[0]).toContain('athletic-male');
        });

        it('adds a female cut on frame f', async () => {
            const { root } = await buildPerson(
                { ...person, appearance: { ...LOOK, frame: 'f', hair: { style: 'long', color: '#000000' }, facialHair: { style: 'none', color: '#000000' } } },
                KIT,
            );
            expect(named(root, 'hair')?.isSkinnedMesh).toBe(true);
        });

        it('skips a cut or beard shaped for the other head, without loading it', async () => {
            mocks.urls.length = 0;
            const { root } = await buildPerson(
                { ...person, appearance: { ...LOOK, frame: 'f', hair: { style: 'parted', color: '#000000' } } },
                KIT,
            );
            expect(mocks.urls.filter((url) => url.includes('/hair/'))).toEqual([]);
            expect(named(root, 'hair')).toBeUndefined();
            expect(named(root, 'facialHair')).toBeUndefined();

            mocks.urls.length = 0;
            await buildPerson({ ...person, appearance: { ...LOOK, hair: { style: 'long', color: '#000000' } } }, KIT);
            expect(mocks.urls.some((url) => url.includes('/hair/long'))).toBe(false);
        });

        it('widens the torso with the girth slider', async () => {
            const width = async (girth: number) => {
                const { root } = await buildPerson({ ...person, appearance: { ...LOOK, build: { girth, shoulders: 0, wingspan: 0 } } }, KIT);
                const mesh = root.getObjectByProperty('isSkinnedMesh', true) as SkinnedMesh;
                mesh.geometry.computeBoundingBox();
                const box = mesh.geometry.boundingBox!;
                return (box.max.x - box.min.x) / (box.max.y - box.min.y);
            };
            expect(await width(1)).toBeGreaterThan(await width(0));
        });

        it('poses from the look', async () => {
            const { root } = await buildPerson({ ...person, appearance: { ...LOOK, pose: 'celebrate' } }, KIT);
            root.updateMatrixWorld(true);
            const y = (name: string) => root.getObjectByName(name)!.getWorldPosition(new Vector3()).y;
            expect(y('hand_l')).toBeGreaterThan(y('head'));
        });

        it('still builds the person when their hair fails to load', async () => {
            mocks.failHair = true;
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                const { root } = await buildPerson({ ...person, appearance: LOOK }, KIT);
                expect(named(root, 'hair')).toBeUndefined();
                expect(warn).toHaveBeenCalled();
            } finally {
                mocks.failHair = false;
                warn.mockRestore();
            }
        });
    });
});
