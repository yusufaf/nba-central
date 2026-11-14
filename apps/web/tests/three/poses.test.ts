import { describe, expect, it } from 'vitest';
import { Vector3, type Object3D } from 'three';
import type { PoseId } from '@/constants/appearance';
import { POSE_BUILDERS } from '@/three/character/poses';
import { skeletonBody } from './fixtures/skeleton';

// The fixture faces +z with its left side on +x; pelvis at y 1, shoulders at
// 1.55, head at 1.75.
const posed = (pose: PoseId) => {
    const root = skeletonBody();
    POSE_BUILDERS[pose](root, new Vector3(0, 0, 1));
    root.updateMatrixWorld(true);
    const at = (name: string) => (root.getObjectByName(name) as Object3D).getWorldPosition(new Vector3());
    return { at, root };
};

const closestApproach = (a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3): number => {
    let best = Infinity;
    for (let i = 0; i <= 20; i++) {
        const p = new Vector3().lerpVectors(a0, a1, i / 20);
        for (let j = 0; j <= 20; j++) best = Math.min(best, p.distanceTo(new Vector3().lerpVectors(b0, b1, j / 20)));
    }
    return best;
};

describe('POSE_BUILDERS', () => {
    it('relaxed keeps the hands below the shoulders', () => {
        const { at } = posed('relaxed');
        for (const side of ['l', 'r']) expect(at(`hand_${side}`).y).toBeLessThan(at(`upperarm_${side}`).y);
    });

    it('handsOnHips puts the hands beside the hips', () => {
        const { at } = posed('handsOnHips');
        const pelvis = at('pelvis');
        for (const side of ['l', 'r']) {
            const hand = at(`hand_${side}`);
            expect(Math.abs(hand.y - pelvis.y)).toBeLessThan(0.2);
            expect(Math.abs(hand.x)).toBeGreaterThan(0.1);
        }
    });

    it('armsCrossed crosses the hands in front of the chest, forearms apart', () => {
        const { at } = posed('armsCrossed');
        const left = at('hand_l');
        const right = at('hand_r');
        expect(left.x).toBeLessThan(-0.05);
        expect(right.x).toBeGreaterThan(0.05);
        for (const hand of [left, right]) {
            expect(hand.z).toBeGreaterThan(0);
            expect(hand.y).toBeGreaterThan(at('pelvis').y);
            expect(hand.y).toBeLessThan(at('upperarm_l').y);
        }
        expect(closestApproach(at('lowerarm_l'), left, at('lowerarm_r'), right)).toBeGreaterThanOrEqual(0.08);
    });

    it('celebrate raises both hands above the head', () => {
        const { at } = posed('celebrate');
        const head = at('head').y;
        expect(at('hand_l').y).toBeGreaterThan(head);
        expect(at('hand_r').y).toBeGreaterThan(head);
    });
});
