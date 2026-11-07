import { describe, expect, it } from 'vitest';
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
import { reshapeBody } from '@/three/character/reshape';

const NAMES = ['spine_03', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l'];

// A T-pose left arm along +x: spine -> clavicle -> upper arm -> forearm -> hand,
// with vertices on each bone, some along the bone and some across it.
const arm = () => {
    const root = new Group();
    const bones = NAMES.map((name) => Object.assign(new Bone(), { name }));
    bones[0].position.set(0, 1.4, 0);
    for (let i = 1; i < bones.length; i++) {
        bones[i].position.set(i === 1 ? 0.05 : 0.3, 0, 0);
        bones[i - 1].add(bones[i]);
    }
    root.add(bones[0]);
    root.updateMatrixWorld(true);

    const world = (i: number) => bones[i].getWorldPosition(new Vector3());
    // Upper arm: one vertex across the bone, one along it. Forearm and hand:
    // one at each origin.
    const points = [
        world(2).add(new Vector3(0, 0.1, 0)),
        world(2).add(new Vector3(0.05, 0, 0)),
        world(3),
        world(4),
    ];
    const boneOf = [2, 2, 3, 4];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points.flatMap((p) => p.toArray())), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(points.flatMap(() => [0, 1, 0])), 3));
    geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(boneOf.flatMap((b) => [b, 0, 0, 0])), 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(boneOf.flatMap(() => [1, 0, 0, 0])), 4));
    const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
    root.add(mesh);
    mesh.bind(new Skeleton(bones), new Matrix4());
    return { root, bones, mesh };
};

const vertex = (mesh: SkinnedMesh, i: number) => new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), i);
const origin = (bone: Bone) => bone.getWorldPosition(new Vector3());

describe('reshapeBody', () => {
    it('wingspan stretches the forearm along the bone', () => {
        const { root, bones } = arm();
        const before = origin(bones[4]).distanceTo(origin(bones[3]));
        reshapeBody(root, { girth: 1, shoulders: 1, wingspan: 1.1 });
        root.updateMatrixWorld(true);
        expect(origin(bones[4]).distanceTo(origin(bones[3]))).toBeCloseTo(before * 1.1, 6);
    });

    it('girth widens across the bone, not along it', () => {
        const { root, bones, mesh } = arm();
        reshapeBody(root, { girth: 1.2, shoulders: 1, wingspan: 1 });
        root.updateMatrixWorld(true);
        const upperArm = origin(bones[2]);
        expect(vertex(mesh, 0).sub(upperArm).y).toBeCloseTo(0.1 * Math.pow(1.2, 0.8), 6);
        expect(vertex(mesh, 1).sub(upperArm).x).toBeCloseTo(0.05, 6);
    });

    it('leaves the mesh undeformed at rest', () => {
        const { root, mesh } = arm();
        reshapeBody(root, { girth: 1.15, shoulders: 1.1, wingspan: 1.05 });
        root.updateMatrixWorld(true);
        mesh.skeleton.update();
        for (let i = 0; i < 4; i++) {
            const stored = vertex(mesh, i);
            const skinned = mesh.applyBoneTransform(i, stored.clone());
            expect(skinned.distanceTo(stored)).toBeLessThan(1e-5);
        }
    });

    it('keeps every bone at unit scale', () => {
        const { root, bones } = arm();
        reshapeBody(root, { girth: 1.2, shoulders: 1.2, wingspan: 1.1 });
        root.updateMatrixWorld(true);
        for (const bone of bones) {
            const scale = bone.getWorldScale(new Vector3());
            expect(scale.toArray().map((s) => Math.round(s * 1e6) / 1e6)).toEqual([1, 1, 1]);
        }
    });
});
