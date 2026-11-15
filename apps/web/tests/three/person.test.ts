import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, MeshStandardMaterial, SkinnedMesh, Vector3, type Mesh } from 'three';
import type { Landmarks } from '@/three/character/kit';
import { skeletonBody, surfacedBody } from './fixtures/skeleton';
import type { PersonAppearance, StaffAppearance } from '@/constants/appearance';
import type { KitColours } from '@/utils/jerseyColours';

const mocks = vi.hoisted(() => ({
    landmarks: [] as Landmarks[],
    kitTexture: vi.fn(() => null),
    kitOptions: [] as { vinyl: string | null; material: MeshStandardMaterial; kind: string; colours: KitColours }[],
    failHair: false,
    surfaced: false,
    urls: [] as string[],
}));

vi.mock('@/three/character/load', async (original) => ({
    ...(await original<typeof import('@/three/character/load')>()),
    loadBody: async (url: string) => {
        mocks.urls.push(url);
        if (url.includes('/hair/') && mocks.failHair) throw new Error('offline');
        return mocks.surfaced && url.includes('athletic-') ? surfacedBody() : skeletonBody();
    },
}));
vi.mock('@/three/character/kit', async (original) => {
    const actual = await original<typeof import('@/three/character/kit')>();
    return {
        ...actual,
        kitTexture: mocks.kitTexture,
        applyKitMaterial: (
            material: MeshStandardMaterial,
            options: { landmarks: Landmarks; vinyl: string | null; kind: string; colours: KitColours },
        ) => {
            mocks.landmarks.push(options.landmarks);
            mocks.kitOptions.push({ vinyl: options.vinyl, material, kind: options.kind, colours: options.colours });
            return material;
        },
    };
});

import { buildPerson } from '@/three/character/person';
import { DEFAULT_OUTFIT } from '@/utils/appearance';
import { agedColour } from '@/utils/appearanceOptions';
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

        describe('with gear', () => {
            // Hair files still load the plain mannequin, whose head bone doesn't
            // match the surfaced body's, so these looks wear none.
            const GEARED: PersonAppearance = {
                ...LOOK,
                hair: { style: 'none', color: '#000000' },
                facialHair: { style: 'none', color: '#000000' },
                accessories: [
                    { id: 'headband', color: '#c8102e' },
                    { id: 'armSleeve', color: '#1c1c1c' },
                    { id: 'glasses', color: '#1c1c1c' },
                ],
            };
            const gear = (root: Group) => {
                const found: string[] = [];
                root.traverse((node) => node.name.startsWith('accessory-') && found.push(`${node.name}@${node.parent!.name}`));
                return found.sort();
            };

            beforeEach(() => {
                mocks.surfaced = true;
            });
            afterEach(() => {
                mocks.surfaced = false;
            });

            it('wears it on the head and the right forearm', async () => {
                const { root } = await buildPerson({ ...person, appearance: GEARED }, KIT);
                expect(gear(root)).toEqual(['accessory-armSleeve@lowerarm_r', 'accessory-head@Head']);
            });

            it('keeps it on through posing and reshaping', async () => {
                const { root } = await buildPerson({ ...person, appearance: { ...GEARED, pose: 'celebrate', build: { girth: 1, shoulders: 0, wingspan: 0 } } }, KIT);
                root.updateMatrixWorld(true);
                expect(gear(root)).toHaveLength(2);
                const sleeve = root.getObjectByName('accessory-armSleeve') as Mesh;
                sleeve.geometry.computeBoundingBox();
                const centre = sleeve.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(sleeve.matrixWorld);
                expect(centre.y).toBeGreaterThan(root.getObjectByName('Head')!.getWorldPosition(new Vector3()).y);
            });

            it('never puts it on a figurine', async () => {
                const { root } = await buildPerson(person, KIT);
                expect(gear(root)).toEqual([]);
            });

            it('fits it on frame f without a warning', async () => {
                const warn = vi.spyOn(console, 'warn');
                try {
                    const { root } = await buildPerson({ ...person, appearance: { ...GEARED, frame: 'f' } }, KIT);
                    expect(gear(root)).toHaveLength(2);
                    expect(warn).not.toHaveBeenCalled();
                } finally {
                    warn.mockRestore();
                }
            });
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

describe('buildPerson for staff', () => {
    const KIT = { colours: { primary: '#123456', secondary: '#ffffff', trim: '#ffffff' }, teamName: 'Owls' };
    const STAFF_LOOK: StaffAppearance = {
        version: 1,
        frame: 'm',
        skin: '#f1c7a5',
        hair: { style: 'parted', color: '#3b2a1e' },
        facialHair: { style: 'beard', color: '#3b2a1e' },
        build: { girth: 0, shoulders: 0, wingspan: 0, heightIn: 74 },
        accessories: [],
        outfit: { style: 'tracksuit', primary: '#552583', secondary: '#fdb927' },
        ageLook: 'young',
        pose: 'relaxed',
    };
    const coach = { id: 'coach', name: 'Coach Vega', role: 'coach' as const, heightInches: 74, weightPounds: 195 };
    const lastKit = () => mocks.kitOptions[mocks.kitOptions.length - 1];

    beforeEach(() => {
        mocks.kitOptions.length = 0;
        mocks.failHair = false;
    });

    it("wears the look's outfit in its colours", async () => {
        await buildPerson({ ...coach, appearance: STAFF_LOOK }, KIT);
        expect(lastKit().kind).toBe('tracksuit');
        expect(lastKit().colours.primary).toBe('#552583');
        expect(lastKit().colours.secondary).toBe('#fdb927');
        expect(lastKit().vinyl).toBeNull();
    });

    it('greys the hair for a veteran', async () => {
        const { root } = await buildPerson({ ...coach, appearance: { ...STAFF_LOOK, ageLook: 'veteran' } }, KIT);
        const hair = root.getObjectByName('hair') as SkinnedMesh;
        expect('#' + (hair.material as MeshStandardMaterial).color.getHexString()).toBe(agedColour('#3b2a1e', 'veteran'));
    });

    it('makes a veteran wider than the same look when young', async () => {
        const width = async (ageLook: StaffAppearance['ageLook']) => {
            const { root } = await buildPerson({ ...coach, appearance: { ...STAFF_LOOK, ageLook } }, KIT);
            const mesh = root.getObjectByProperty('isSkinnedMesh', true) as SkinnedMesh;
            mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox!;
            return (box.max.x - box.min.x) / (box.max.y - box.min.y);
        };
        expect(await width('veteran')).toBeGreaterThan(await width('young'));
    });

    it('puts a figurine coach in the default suit', async () => {
        await buildPerson({ ...coach, heightInches: null, weightPounds: null }, KIT);
        expect(lastKit().kind).toBe('suit');
        expect(lastKit().vinyl).toBe('#c8c3ba');
        expect(lastKit().colours.primary).toBe(DEFAULT_OUTFIT.primary);
    });

    it("stands a custom coach at the look's height", async () => {
        const tall = await buildPerson({ ...coach, heightInches: 80, appearance: STAFF_LOOK }, KIT);
        const figurine = await buildPerson({ ...coach, heightInches: null, weightPounds: null }, KIT);
        expect(tall.headHeight).toBeGreaterThan(figurine.headHeight);
    });

    it('builds a coach given a player look as a default suit', async () => {
        const playerLook: PersonAppearance = { ...STAFF_LOOK, build: { girth: 0, shoulders: 0, wingspan: 0 } } as never;
        delete (playerLook as Partial<StaffAppearance>).outfit;
        delete (playerLook as Partial<StaffAppearance>).ageLook;
        await expect(buildPerson({ ...coach, appearance: playerLook }, KIT)).resolves.toBeDefined();
        expect(lastKit().kind).toBe('suit');
        expect(lastKit().colours.primary).toBe(DEFAULT_OUTFIT.primary);
    });
});
