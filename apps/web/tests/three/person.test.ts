import { describe, expect, it, vi } from 'vitest';
import {
    Bone,
    BufferAttribute,
    BufferGeometry,
    Group,
    Matrix4,
    MeshStandardMaterial,
    Skeleton,
    SkinnedMesh,
    Vector3,
} from 'three';
import type { Landmarks } from '@/three/character/kit';

const mocks = vi.hoisted(() => ({ landmarks: [] as Landmarks[], kitTexture: vi.fn(() => null) }));

vi.mock('@/three/character/load', async (original) => ({
    ...(await original<typeof import('@/three/character/load')>()),
    loadBody: async () => skeletonBody(),
}));
vi.mock('@/three/character/kit', async (original) => {
    const actual = await original<typeof import('@/three/character/kit')>();
    return {
        ...actual,
        kitTexture: mocks.kitTexture,
        applyKitMaterial: (material: MeshStandardMaterial, options: { landmarks: Landmarks }) => {
            mocks.landmarks.push(options.landmarks);
            return material;
        },
    };
});

import { buildPerson } from '@/three/character/person';
import { findLandmarks } from '@/three/character/kit';
import { reshapeBody } from '@/three/character/reshape';

type Spec = [name: string, parent: string | null, offset: [number, number, number]];
const SIDE = (s: 'l' | 'r', x: number): Spec[] => [
    [`clavicle_${s}`, 'spine_03', [0.05 * x, 0.1, 0]],
    [`upperarm_${s}`, `clavicle_${s}`, [0.15 * x, 0, 0]],
    [`lowerarm_${s}`, `upperarm_${s}`, [0.3 * x, 0, 0]],
    [`hand_${s}`, `lowerarm_${s}`, [0.25 * x, 0, 0]],
    [`thigh_${s}`, 'pelvis', [0.1 * x, -0.05, 0]],
    [`calf_${s}`, `thigh_${s}`, [0, -0.45, 0]],
    [`foot_${s}`, `calf_${s}`, [0, -0.45, 0]],
    [`ball_${s}`, `foot_${s}`, [0, -0.05, 0.1]],
];
const SPECS: Spec[] = [
    ['pelvis', null, [0, 1, 0]],
    ['spine_01', 'pelvis', [0, 0.15, 0]],
    ['spine_02', 'spine_01', [0, 0.15, 0]],
    ['spine_03', 'spine_02', [0, 0.15, 0]],
    ['neck_01', 'spine_03', [0, 0.2, 0]],
    ['head', 'neck_01', [0, 0.1, 0]],
    ...SIDE('l', 1),
    ...SIDE('r', -1),
];

// A T-pose mannequin with the real rig's bone names and a few vertices
// on and around each bone, so the torso and limbs have width to reshape.
function skeletonBody(): Group {
    const root = new Group();
    const bones = SPECS.map(([name]) => Object.assign(new Bone(), { name }));
    SPECS.forEach(([, parent, offset], i) => {
        bones[i].position.set(...offset);
        if (parent) bones[SPECS.findIndex(([n]) => n === parent)].add(bones[i]);
    });
    root.add(bones[0]);
    root.updateMatrixWorld(true);
    const points: number[] = [];
    const owners: number[] = [];
    bones.forEach((bone, i) => {
        const at = bone.getWorldPosition(new Vector3());
        for (const d of [[0, 0, 0], [0.08, 0, 0], [-0.08, 0, 0], [0, 0, 0.08], [0, 0, -0.08]]) {
            points.push(at.x + d[0], at.y + d[1], at.z + d[2]);
            owners.push(i);
        }
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(points.map((_, i) => (i % 3 === 1 ? 1 : 0))), 3));
    geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(owners.flatMap((b) => [b, 0, 0, 0])), 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(owners.flatMap(() => [1, 0, 0, 0])), 4));
    const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
    root.add(mesh);
    mesh.bind(new Skeleton(bones), new Matrix4());
    return root;
}

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
});
