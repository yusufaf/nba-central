import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_PRESETS, MAX_FRAMING_DISTANCE, PRESET_LABELS, TWO_ROWS_BELOW_ASPECT, framePerson, framePreset } from '@/three/scene/cameraPresets';

const deg = (d: number) => (d * Math.PI) / 180;
const distance = (frame: { position: number[]; target: number[] }) =>
    Math.hypot(...frame.position.map((p, i) => p - frame.target[i]));
const halfFovH = (fov: number, aspect: number) => Math.atan(Math.tan(deg(fov) / 2) * aspect);

describe('framePreset', () => {
    it('team at 16:9 uses the fit formula', () => {
        const aspect = 16 / 9;
        const frame = framePreset('team', aspect);
        const expected = 1.08 * Math.max(4.9 / Math.tan(halfFovH(40, aspect)), 1.3 / Math.tan(deg(20)));
        expect(frame.fov).toBe(40);
        expect(distance(frame)).toBeCloseTo(expected, 2);
    });

    it('team in portrait widens the lens and fits the whole row', () => {
        const aspect = 0.625;
        const frame = framePreset('team', aspect);
        expect(frame.fov).toBe(50);
        expect(distance(frame)).toBeLessThan(MAX_FRAMING_DISTANCE);
        expect(distance(frame) * Math.tan(halfFovH(50, aspect))).toBeGreaterThanOrEqual(2.7);
    });

    it('narrower than the viewport allows is capped, not pushed into the stands', () => {
        expect(distance(framePreset('team', 0.46))).toBeCloseTo(MAX_FRAMING_DISTANCE, 6);
    });

    it('fixed presets ignore aspect', () => {
        const narrow = framePreset('courtside', 0.5);
        const wide = framePreset('courtside', 2);
        expect(narrow.position).toEqual(wide.position);
        expect(narrow.target).toEqual(wide.target);
    });

    it('every preset has a label', () => {
        expect(CAMERA_PRESETS.every((preset) => PRESET_LABELS[preset])).toBe(true);
    });

    it('a near-square view frames the two-row team in full', () => {
        for (const aspect of [1, 1.1, TWO_ROWS_BELOW_ASPECT - 0.01]) {
            const frame = framePreset('team', aspect);
            expect(distance(frame)).toBeLessThan(MAX_FRAMING_DISTANCE);
            expect(distance(frame) * Math.tan(halfFovH(frame.fov, aspect))).toBeGreaterThanOrEqual(2.7);
        }
    });

    it('a wide view frames the one-row team in full', () => {
        const aspect = TWO_ROWS_BELOW_ASPECT;
        const frame = framePreset('team', aspect);
        expect(distance(frame) * Math.tan(halfFovH(frame.fov, aspect))).toBeGreaterThanOrEqual(4.9);
    });
});

describe('framePerson', () => {
    const inView = (frame: ReturnType<typeof framePerson>, aspect: number, y: number) => {
        const camera = new PerspectiveCamera(frame.fov, aspect, 0.1, 100);
        camera.position.set(...frame.position);
        camera.lookAt(new Vector3(...frame.target));
        camera.updateMatrixWorld();
        return new Vector3(0, y, 0).project(camera).y;
    };

    it('aims at the middle of the person and backs off for a taller one', () => {
        const short = framePerson(1.8, 1);
        const tall = framePerson(2.1, 1);
        expect(short.target[1]).toBeCloseTo(0.625 * 1.8);
        expect(distance(tall)).toBeGreaterThan(distance(short));
    });

    it('backs off in a narrow view', () => {
        expect(distance(framePerson(2, 0.5))).toBeGreaterThan(distance(framePerson(2, 1)));
    });

    it.for([1, 0.6, 1.6])('keeps raised hands and the shadow in view at aspect %s', (aspect) => {
        const frame = framePerson(2, aspect);
        for (const y of [1.3 * 2, -0.05 * 2]) {
            const ndc = inView(frame, aspect, y);
            expect(ndc).toBeGreaterThan(-1);
            expect(ndc).toBeLessThan(1);
        }
    });
});
