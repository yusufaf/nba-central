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

type Side = 'l' | 'r';
// Where the upper arm and the forearm point, given the side's horizontal
// direction away from the chest and the way the body faces.
type ArmAim = (outward: Vector3, forward: Vector3, side: Side) => { upper: Vector3; lower: Vector3 };

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);

const aimArms = (aim: ArmAim) => (root: Object3D, forward: Vector3) => {
    root.updateMatrixWorld(true);
    const chest = bone(root, 'spine_03');
    for (const side of ['l', 'r'] as const) {
        const upper = bone(root, `upperarm_${side}`);
        const lower = bone(root, `lowerarm_${side}`);
        const hand = bone(root, `hand_${side}`);
        if (!chest || !upper || !lower || !hand) continue;
        const outward = upper.getWorldPosition(new Vector3()).sub(chest.getWorldPosition(new Vector3()));
        outward.y = 0;
        outward.normalize();
        const target = aim(outward, forward, side);
        point(upper, lower, target.upper);
        point(lower, hand, target.lower);
    }
};

// Arms down by the sides, a slight bend at the elbow.
const relaxArms = aimArms((outward, forward) => ({
    upper: DOWN.clone().addScaledVector(outward, 0.16),
    lower: DOWN.clone().addScaledVector(outward, 0.1).addScaledVector(forward, 0.22),
}));

// Elbows out, hands back on the hips.
const handsOnHips = aimArms((outward, forward) => ({
    upper: DOWN.clone().addScaledVector(outward, 0.75).addScaledVector(forward, -0.15),
    lower: DOWN.clone().multiplyScalar(0.6).addScaledVector(outward, -0.9).addScaledVector(forward, 0.1),
}));

// Elbows in front of the chest, forearms across it. Mirrored forearms would
// meet in one spot and pass through each other, so the left one rests higher
// and further back, on top of the right.
const armsCrossed = aimArms((outward, forward, side) => ({
    upper: DOWN.clone().addScaledVector(forward, 0.6).addScaledVector(outward, -0.15),
    lower:
        side === 'l'
            ? outward.clone().negate().addScaledVector(forward, 0.3).addScaledVector(UP, 0.45)
            : outward.clone().negate().addScaledVector(forward, 0.5).addScaledVector(UP, -0.1),
}));

// Both arms up in a V.
const celebrate = aimArms((outward) => ({
    upper: UP.clone().multiplyScalar(0.9).addScaledVector(outward, 0.5),
    lower: UP.clone().addScaledVector(outward, 0.25),
}));

export const POSE_BUILDERS: Record<PoseId, (root: Object3D, forward: Vector3) => void> = {
    relaxed: relaxArms,
    handsOnHips,
    armsCrossed,
    celebrate,
};
