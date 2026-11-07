import { describe, expect, it } from 'vitest';
import { CAMERA_PRESETS, MAX_FRAMING_DISTANCE, PRESET_LABELS, framePreset } from '@/three/scene/cameraPresets';

const deg = (d: number) => (d * Math.PI) / 180;
const distance = (frame: ReturnType<typeof framePreset>) =>
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
});
