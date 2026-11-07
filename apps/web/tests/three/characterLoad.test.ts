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
    type Object3D,
} from 'three';
import { cloneCharacter, dequantizeSkinned } from '@/three/character/load';

// Two bones, one vertex on each, positions stored at 1/100 scale with the
// x100 hidden in the inverse bind matrices: what gltf-transform's meshopt
// quantization produces for a skinned mesh.
const quantizedCharacter = () => {
    const root = new Group();
    const hip = new Bone();
    hip.name = 'hip';
    const knee = new Bone();
    knee.name = 'knee';
    knee.position.set(0, 1, 0);
    hip.add(knee);
    root.add(hip);
    root.updateMatrixWorld(true);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0.01, 0.02, 0, 0, 0.015, 0.01]), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 1, 0, 0]), 3));
    geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array([0, 0, 0, 0, 1, 0, 0, 0]), 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0]), 4));
    const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
    root.add(mesh);
    const hidden = new Matrix4().makeScale(100, 100, 100);
    const inverses = [hip, knee].map((bone) => bone.matrixWorld.clone().invert().multiply(hidden));
    mesh.bind(new Skeleton([hip, knee], inverses), new Matrix4());
    return { root, mesh, hip, knee };
};

const skinnedOf = (root: Object3D) => {
    let found: SkinnedMesh | null = null;
    root.traverse((node) => {
        if ((node as SkinnedMesh).isSkinnedMesh) found = node as SkinnedMesh;
    });
    return found as unknown as SkinnedMesh;
};

describe('dequantizeSkinned', () => {
    it('bakes the hidden scale into positions', () => {
        const { root, mesh, hip, knee } = quantizedCharacter();
        dequantizeSkinned(root);
        const position = mesh.geometry.getAttribute('position');
        expect(new Vector3().fromBufferAttribute(position, 0).toArray()).toEqual([1, 2, 0].map((v) => expect.closeTo(v, 5)));
        expect(new Vector3().fromBufferAttribute(position, 1).toArray()).toEqual([0, 1.5, 1].map((v) => expect.closeTo(v, 5)));
        [hip, knee].forEach((bone, i) => {
            const expected = bone.matrixWorld.clone().invert().elements;
            mesh.skeleton.boneInverses[i].elements.forEach((value, j) => expect(value).toBeCloseTo(expected[j], 6));
        });
    });

    it('keeps normals unit length', () => {
        const { root, mesh } = quantizedCharacter();
        dequantizeSkinned(root);
        const normal = mesh.geometry.getAttribute('normal');
        for (let v = 0; v < normal.count; v++) expect(new Vector3().fromBufferAttribute(normal, v).length()).toBeCloseTo(1, 6);
    });
});

describe('cloneCharacter', () => {
    it("clones don't share inverse bind matrices", () => {
        const { root, mesh } = quantizedCharacter();
        dequantizeSkinned(root);
        const sourceBefore = mesh.skeleton.boneInverses[1].clone();
        const first = cloneCharacter(root);
        const second = cloneCharacter(root);
        const firstMesh = skinnedOf(first);
        firstMesh.skeleton.bones[1].position.set(0, 2, 0);
        first.updateMatrixWorld(true);
        firstMesh.skeleton.calculateInverses();
        expect(skinnedOf(second).skeleton.boneInverses[1].equals(sourceBefore)).toBe(true);
        expect(mesh.skeleton.boneInverses[1].equals(sourceBefore)).toBe(true);
    });

    it("clones don't share geometry", () => {
        const { root } = quantizedCharacter();
        const first = cloneCharacter(root);
        const second = cloneCharacter(root);
        skinnedOf(first).geometry.getAttribute('position').setX(0, 42);
        expect(skinnedOf(second).geometry.getAttribute('position').getX(0)).not.toBe(42);
    });
});
