import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('3D assets', () => {
    it('the body asset is a GLB within budget', () => {
        const file = readFileSync(join(__dirname, '../../src/three/assets/athletic-male.glb'));
        expect(file.subarray(0, 4).toString('ascii')).toBe('glTF');
        expect(file.length).toBeLessThan(600 * 1024);
    });
});
