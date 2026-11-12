// Static poses, by id. The model is in a T-pose until one is applied.
import { Bone, Quaternion, Vector3, type Object3D } from 'three';
import type { PoseId } from '@/constants/appearance';

const bone = (root: Object3D, name: string) => root.getObjectByName(name) as Bone | undefined;

// Turns a bone in world space so its child points along `target`, which
// works whatever the bone's roll.
const point = (parent: Bone, child: Bone, target: Vector3) => {
    parent.updateMatrixWorld(true);
    const from = child.getWorldPosition(new Vector3()).sub(parent.getWorldPosition(new Vector3())).normalize();
    const turn = new Quaternion().setFromUnitVectors(from, target.clone().normalize());
    const world = parent.getWorldQuaternion(new Quaternion());
    const above = parent.parent ? parent.parent.getWorldQuaternion(new Quaternion()) : new Quaternion();
    parent.quaternion.copy(above.invert().multiply(turn).multiply(world));
    parent.updateMatrixWorld(true);
};

// Arms down by the sides, a slight bend at the elbow.
const relaxArms = (root: Object3D, forward: Vector3) => {
    root.updateMatrixWorld(true);
    const chest = bone(root, 'spine_03');
    for (const side of ['l', 'r']) {
        const upper = bone(root, `upperarm_${side}`);
        const lower = bone(root, `lowerarm_${side}`);
        const hand = bone(root, `hand_${side}`);
        if (!chest || !upper || !lower || !hand) continue;
        const outward = upper.getWorldPosition(new Vector3()).sub(chest.getWorldPosition(new Vector3()));
        outward.y = 0;
        outward.normalize();
        point(upper, lower, new Vector3(0, -1, 0).addScaledVector(outward, 0.16));
        point(lower, hand, new Vector3(0, -1, 0).addScaledVector(outward, 0.1).addScaledVector(forward, 0.22));
    }
};

export const POSE_BUILDERS: Record<PoseId, (root: Object3D, forward: Vector3) => void> = {
    relaxed: relaxArms,
};
