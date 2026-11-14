import { Bone, BufferAttribute, BufferGeometry, Group, Matrix4, MeshStandardMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';

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
export function skeletonBody(): Group {
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

