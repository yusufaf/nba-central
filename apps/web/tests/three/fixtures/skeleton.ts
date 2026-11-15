import {
    Bone,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CylinderGeometry,
    Group,
    Matrix4,
    MeshStandardMaterial,
    Skeleton,
    SkinnedMesh,
    SphereGeometry,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

const rig = (headName: string): { root: Group; bones: Bone[] } => {
    const root = new Group();
    const bones = SPECS.map(([name]) => Object.assign(new Bone(), { name: name === 'head' ? headName : name }));
    SPECS.forEach(([, parent, offset], i) => {
        bones[i].position.set(...offset);
        if (parent) bones[SPECS.findIndex(([n]) => n === parent)].add(bones[i]);
    });
    root.add(bones[0]);
    root.updateMatrixWorld(true);
    return { root, bones };
};

// A T-pose mannequin with the real rig's bone names and a few vertices
// on and around each bone, so the torso and limbs have width to reshape.
export function skeletonBody(): Group {
    const { root, bones } = rig('head');
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


const BONE = Object.fromEntries(SPECS.map(([name], i) => [name, i]));

// One primitive, moved to `at` and skinned wholly to one bone.
const part = (geometry: BufferGeometry, at: Vector3, bone: string): BufferGeometry => {
    geometry.translate(at.x, at.y, at.z);
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(count * 4).map((_, i) => (i % 4 ? 0 : BONE[bone])), 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(count * 4).map((_, i) => (i % 4 ? 0 : 1)), 4));
    return geometry;
};

/**
 * The mannequin with real surfaces: a 0.1 m head sphere 6 cm above the
 * `Head` bone (capitalised, as on the real rig), a box torso, 4 cm cylinder
 * arms, eyes and brows on the face, and optionally a hair cap of radius
 * `hair` about the head's centre. Fits the gear the way the real body does.
 */
export function surfacedBody(options: { hair?: number } = {}): Group {
    const { root, bones } = rig('Head');
    const at = (name: string) => bones[BONE[name]].getWorldPosition(new Vector3());
    const head = at('head').add(new Vector3(0, 0.06, 0));
    const limb = (from: string, to: string) => {
        const a = at(from);
        const b = at(to);
        const geometry = new CylinderGeometry(0.04, 0.04, a.distanceTo(b), 16, 4, true).rotateZ(Math.PI / 2);
        return part(geometry, a.add(b).multiplyScalar(0.5), from);
    };
    const skinned = (parts: BufferGeometry[], material: string, name: string) => {
        const mesh = new SkinnedMesh(mergeGeometries(parts)!, Object.assign(new MeshStandardMaterial(), { name: material }));
        mesh.name = name;
        root.add(mesh);
        mesh.bind(new Skeleton(bones), new Matrix4());
        return mesh;
    };
    skinned(
        [
            part(new SphereGeometry(0.1, 24, 16), head, 'head'),
            part(new BoxGeometry(0.3, 0.45, 0.2), at('spine_02'), 'spine_02'),
            ...(['l', 'r'] as const).flatMap((s) => [limb(`upperarm_${s}`, `lowerarm_${s}`), limb(`lowerarm_${s}`, `hand_${s}`)]),
        ],
        'MI_Body',
        'Body',
    );
    const pair = (make: () => BufferGeometry, offset: [number, number, number]) =>
        [1, -1].map((x) => part(make(), head.clone().add(new Vector3(offset[0] * x, offset[1] - 0.06, offset[2])), 'head'));
    skinned(pair(() => new SphereGeometry(0.012, 8, 6), [0.035, 0.065, 0.09]), 'MI_Eyes', 'Eyes');
    skinned(pair(() => new BoxGeometry(0.03, 0.006, 0.01), [0.035, 0.085, 0.095]), 'MI_Hair_1', 'Eyebrows');
    if (options.hair) skinned([part(new SphereGeometry(options.hair, 24, 16, 0, 2 * Math.PI, 0, 0.55 * Math.PI), head, 'head')], 'MI_Hair_2', 'hair');
    return root;
}
