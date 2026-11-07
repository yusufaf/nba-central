// Reshapes a skinned character in its rest pose.
//
// Scaling bones directly skews any child that is rotated relative to its
// parent (bone roll), and poses then fight the scale. Instead, each bone gets
// a linear map about its own origin (stretch along the bone, girth across
// it). The map is baked into the vertices by their skin weights, the joints
// move to where the maps put them, and the inverse bind matrices are
// recomputed. The skeleton keeps unit scale, so any pose still applies.
import { Bone, BufferAttribute, Matrix3, Matrix4, Object3D, SkinnedMesh, Vector3 } from 'three';

export interface BodyShape {
    girth: number; // 1 = as modelled; scales across torso and limbs
    shoulders: number; // stretches the clavicles, so the arms sit wider
    wingspan: number; // stretches the upper and lower arms
}

const TORSO = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03']);
const LIMBS = new Set(['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r']);
const ARM_LENGTH = new Set(['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r']);
const CLAVICLES = new Set(['clavicle_l', 'clavicle_r']);
const PRIMARY_CHILD: Record<string, string> = { pelvis: 'spine_01', spine_03: 'neck_01' };

const isBone = (node: Object3D | null): node is Bone => !!node && (node as Bone).isBone;

const scaleFor = (name: string, shape: BodyShape): { along: number; across: number } => {
    if (TORSO.has(name)) return { along: 1, across: shape.girth };
    if (ARM_LENGTH.has(name)) return { along: shape.wingspan, across: Math.pow(shape.girth, 0.8) };
    if (LIMBS.has(name)) return { along: 1, across: Math.pow(shape.girth, 0.8) };
    if (CLAVICLES.has(name)) return { along: shape.shoulders, across: 1 };
    if (name === 'neck_01') return { along: 1, across: Math.sqrt(shape.girth) };
    return { along: 1, across: 1 };
};

interface BoneMap {
    origin: Vector3; // rest position, world space
    newOrigin: Vector3;
    linear: Matrix3; // stretch/girth about the origin
    normal: Matrix3; // inverse-transpose of linear, for normals
}

export const reshapeBody = (root: Object3D, shape: BodyShape) => {
    root.updateMatrixWorld(true);
    const meshes: SkinnedMesh[] = [];
    root.traverse((node) => {
        if ((node as SkinnedMesh).isSkinnedMesh) meshes.push(node as SkinnedMesh);
    });
    if (meshes.length === 0) return;

    const bones = meshes[0].skeleton.bones;
    const maps = new Map<string, BoneMap>();
    const rootBones = bones.filter((bone) => !isBone(bone.parent));

    const directionOf = (bone: Bone): Vector3 => {
        const children = bone.children.filter(isBone);
        const child = children.find((c) => c.name === PRIMARY_CHILD[bone.name]) ?? children[0];
        const from = bone.getWorldPosition(new Vector3());
        if (child) return child.getWorldPosition(new Vector3()).sub(from).normalize();
        return isBone(bone.parent) ? directionOf(bone.parent) : new Vector3(0, 1, 0);
    };

    const visit = (bone: Bone, parent: BoneMap | null) => {
        const origin = bone.getWorldPosition(new Vector3());
        const d = directionOf(bone);
        const { along, across } = scaleFor(bone.name, shape);
        // linear = across * I + (along - across) * d dᵀ
        const e = (i: number, j: number) => (i === j ? across : 0) + (along - across) * d.getComponent(i) * d.getComponent(j);
        const linear = new Matrix3().set(e(0, 0), e(0, 1), e(0, 2), e(1, 0), e(1, 1), e(1, 2), e(2, 0), e(2, 1), e(2, 2));
        const newOrigin = parent
            ? origin.clone().sub(parent.origin).applyMatrix3(parent.linear).add(parent.newOrigin)
            : origin.clone();
        const map: BoneMap = { origin, newOrigin, linear, normal: linear.clone().invert().transpose() };
        maps.set(bone.name, map);
        for (const child of bone.children) if (isBone(child)) visit(child, map);
    };
    for (const bone of rootBones) visit(bone, null);

    const world = new Vector3();
    const sum = new Vector3();
    const part = new Vector3();
    const normalSum = new Vector3();
    for (const mesh of meshes) {
        const geometry = mesh.geometry;
        const position = geometry.getAttribute('position') as BufferAttribute;
        const normal = geometry.getAttribute('normal') as BufferAttribute | undefined;
        const skinIndex = geometry.getAttribute('skinIndex') as BufferAttribute;
        const skinWeight = geometry.getAttribute('skinWeight') as BufferAttribute;
        const bind = mesh.bindMatrix;
        const unbind = new Matrix4().copy(bind).invert();
        const bindNormal = new Matrix3().getNormalMatrix(bind);
        const unbindNormal = new Matrix3().getNormalMatrix(unbind);
        const boneMaps = mesh.skeleton.bones.map((bone) => maps.get(bone.name));

        for (let v = 0; v < position.count; v++) {
            world.fromBufferAttribute(position, v).applyMatrix4(bind);
            sum.set(0, 0, 0);
            normalSum.set(0, 0, 0);
            const n = normal ? new Vector3().fromBufferAttribute(normal, v).applyMatrix3(bindNormal) : null;
            let total = 0;
            for (let k = 0; k < 4; k++) {
                const w = skinWeight.getComponent(v, k);
                if (w === 0) continue;
                const map = boneMaps[skinIndex.getComponent(v, k)];
                if (!map) continue;
                part.copy(world).sub(map.origin).applyMatrix3(map.linear).add(map.newOrigin);
                sum.addScaledVector(part, w);
                if (n) normalSum.addScaledVector(n.clone().applyMatrix3(map.normal), w);
                total += w;
            }
            if (total === 0) continue;
            sum.divideScalar(total).applyMatrix4(unbind);
            position.setXYZ(v, sum.x, sum.y, sum.z);
            if (normal && n) {
                normalSum.applyMatrix3(unbindNormal).normalize();
                normal.setXYZ(v, normalSum.x, normalSum.y, normalSum.z);
            }
        }
        position.needsUpdate = true;
        if (normal) normal.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }

    // Move the joints, top down, keeping every bone's world rotation.
    const inverseParent = new Matrix4();
    const place = (bone: Bone) => {
        const map = maps.get(bone.name);
        if (map && bone.parent) {
            bone.parent.updateMatrixWorld(true);
            inverseParent.copy(bone.parent.matrixWorld).invert();
            bone.position.copy(map.newOrigin).applyMatrix4(inverseParent);
            bone.updateMatrixWorld(true);
        }
        for (const child of bone.children) if (isBone(child)) place(child);
    };
    for (const bone of rootBones) place(bone);

    root.updateMatrixWorld(true);
    const skeletons = new Set(meshes.map((mesh) => mesh.skeleton));
    for (const skeleton of skeletons) skeleton.calculateInverses();
};
