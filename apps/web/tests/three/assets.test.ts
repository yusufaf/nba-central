import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPEARANCE_FRAMES, FACIAL_HAIR_STYLES, HAIR_STYLES, POSES } from '@/constants/appearance';
import { BODY_ASSETS, FACIAL_HAIR_ASSETS, HAIR_ASSETS } from '@/three/character/appearance';
import { POSE_BUILDERS } from '@/three/character/poses';

const WEB = join(__dirname, '../..');

const expectGlb = (path: string, maxKb: number) => {
    const file = readFileSync(path);
    expect(file.subarray(0, 4).toString('ascii')).toBe('glTF');
    expect(file.length).toBeLessThan(maxKb * 1024);
};

// Vitest serves a `?url` import as its root-relative source path.
const fileFor = (url: string, id: string) => {
    const path = join(WEB, url.replace(/^\//, ''));
    return existsSync(path) ? path : join(WEB, 'src/three/assets/hair', `${id}.glb`);
};

describe('3D assets', () => {
    it.for(['athletic-male', 'athletic-female'])('the body asset %s is a GLB within budget', (name) => {
        expectGlb(join(WEB, `src/three/assets/${name}.glb`), 600);
    });

    it('has a body for every frame', () => {
        expect(Object.keys(BODY_ASSETS).sort()).toEqual([...APPEARANCE_FRAMES].sort());
        expect(BODY_ASSETS.f).toContain('athletic-female.glb');
        expect(BODY_ASSETS.m).toContain('athletic-male.glb');
    });

    it.for(HAIR_STYLES.filter((id) => id !== 'none'))('hair style %s has a GLB', (id) => {
        const url = HAIR_ASSETS[id];
        expect(url).toContain(`${id}.glb`);
        expectGlb(fileFor(url, id), 200);
    });

    it.for(FACIAL_HAIR_STYLES.filter((id) => id !== 'none'))('facial hair %s has a GLB', (id) => {
        const url = FACIAL_HAIR_ASSETS[id];
        expect(url).toContain(`${id}.glb`);
        expectGlb(fileFor(url, id), 200);
    });

    it('has an asset for every id and none for anything else', () => {
        expect(Object.keys(HAIR_ASSETS).sort()).toEqual(HAIR_STYLES.filter((id) => id !== 'none').sort());
        expect(Object.keys(FACIAL_HAIR_ASSETS).sort()).toEqual(FACIAL_HAIR_STYLES.filter((id) => id !== 'none').sort());
        expect(Object.keys(POSE_BUILDERS)).toEqual([...POSES]);
    });
});
