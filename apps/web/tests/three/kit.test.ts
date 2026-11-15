import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasTexture, Color, MeshStandardMaterial, type SkinnedMesh } from 'three';
import { applyKitMaterial, findLandmarks, kitTexture, type KitKind, type Landmarks } from '@/three/character/kit';
import { skeletonBody } from './fixtures/skeleton';
import { HOME_KIT } from '@/utils/jerseyColours';

const LANDMARKS: Landmarks = {
    hipY: 0.95,
    kneeY: 0.5,
    ankleY: 0.08,
    shoulderY: 1.45,
    neckY: 1.55,
    centreX: 0,
    shoulderX: 0.2,
    elbowX: 0.45,
    front: 1,
    frontZ: 0,
    height: 1.81,
};

describe('kitTexture', () => {
    afterEach(() => vi.restoreAllMocks());

    it('puts the team name on the front half', () => {
        const fillText = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            new Proxy({ fillText }, { get: (target, key) => (key in target ? target[key as 'fillText'] : () => {}) }) as unknown as CanvasRenderingContext2D,
        );
        kitTexture({ kind: 'player', teamName: 'Night Owls', trim: '#ffffff', secondary: '#c9a227' });
        const call = fillText.mock.calls.find(([text]) => String(text).includes('NIGHT OWLS'));
        expect(call).toBeDefined();
        expect(call![1]).toBeLessThan(512);
    });

    const spyFillText = () => {
        const fillText = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            new Proxy({ fillText }, { get: (target, key) => (key in target ? target[key as 'fillText'] : () => {}) }) as unknown as CanvasRenderingContext2D,
        );
        return fillText;
    };

    it('draws the number on the front and back halves', () => {
        const fillText = spyFillText();
        kitTexture({ kind: 'player', teamName: 'Night Owls', number: '23', trim: '#ffffff', secondary: '#c9a227' });
        const xs = fillText.mock.calls.filter(([text]) => text === '23').map(([, x]) => x as number);
        expect(xs.some((x) => x < 512)).toBe(true);
        expect(xs.some((x) => x >= 512)).toBe(true);
        expect(fillText.mock.calls.some(([text]) => String(text).includes('NIGHT OWLS'))).toBe(true);
    });

    it('leaves the back empty without a number', () => {
        const fillText = spyFillText();
        kitTexture({ kind: 'player', teamName: 'Night Owls', number: null, trim: '#ffffff', secondary: '#c9a227' });
        expect(fillText.mock.calls.every(([, x]) => (x as number) < 512)).toBe(true);
    });

    it.for(['suit', 'polo', 'tracksuit'] as const)('draws nothing for a %s', (kind) => {
        const fillText = spyFillText();
        kitTexture({ kind, teamName: 'Night Owls', number: '23', trim: '#ffffff', secondary: '#c9a227' });
        expect(fillText).not.toHaveBeenCalled();
    });
});

describe('applyKitMaterial', () => {
    it('clones the source and keys its shader program by kind', () => {
        const source = new MeshStandardMaterial();
        const texture = new CanvasTexture(document.createElement('canvas'));
        const options = { colours: HOME_KIT, landmarks: LANDMARKS, vinyl: '#c8c3ba', texture };
        const player = applyKitMaterial(source, { ...options, kind: 'player' });
        const suit = applyKitMaterial(source, { ...options, kind: 'suit' });
        expect(player).not.toBe(source);
        expect(player.customProgramCacheKey()).not.toBe(suit.customProgramCacheKey());
    });
});

describe('staff outfits', () => {
    const OUTFIT = { primary: '#552583', secondary: '#fdb927', trim: '#fdb927' };
    // The uniforms the patched shader is compiled with.
    const uniformsOf = (kind: KitKind) => {
        const material = applyKitMaterial(new MeshStandardMaterial(), {
            kind,
            colours: OUTFIT,
            landmarks: LANDMARKS,
            vinyl: null,
            texture: new CanvasTexture(document.createElement('canvas')),
        });
        const shader = {
            uniforms: {} as Record<string, { value: unknown }>,
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader: '#include <common>\n#include <map_fragment>',
        };
        material.onBeforeCompile(shader as never, undefined as never);
        return { material, uniforms: shader.uniforms, shader };
    };

    it.for([
        ['suit', 1],
        ['polo', 2],
        ['tracksuit', 3],
    ] as const)('keys a %s by kind, as outfit %i', ([kind, index]) => {
        const { material, uniforms } = uniformsOf(kind);
        expect(material.customProgramCacheKey()).toBe(`kit-${kind}`);
        expect(uniforms.uOutfit.value).toBe(index);
    });

    it("paints a staff outfit in the look's own colours", () => {
        const { uniforms } = uniformsOf('suit');
        expect((uniforms.uPrimary.value as Color).getHexString()).toBe('552583');
        expect((uniforms.uSecondary.value as Color).getHexString()).toBe('fdb927');
    });

    it('passes the elbow and the rest normal to the shader', () => {
        const { uniforms, shader } = uniformsOf('polo');
        expect(uniforms.uElbowX.value).toBe(LANDMARKS.elbowX);
        expect(shader.vertexShader).toContain('vRestNormal = normal;');
    });

    // jsdom can't compile GLSL, so this stands in for it: a uniform the
    // fragment uses but never declares is a shader that fails on a real GPU.
    it.for(['player', 'suit', 'polo', 'tracksuit'] as const)('declares every uniform the %s shader uses', (kind) => {
        const { shader } = uniformsOf(kind);
        const used = new Set(shader.fragmentShader.match(/\bu[A-Z]\w*/g));
        const declared = new Set([...shader.fragmentShader.matchAll(/uniform \w+ (u[A-Z]\w*);/g)].map((m) => m[1]));
        expect([...used].filter((name) => !declared.has(name))).toEqual([]);
    });

    it('finds the elbow outside the shoulder', () => {
        const mesh = skeletonBody().children.find((c): c is SkinnedMesh => (c as SkinnedMesh).isSkinnedMesh)!;
        const landmarks = findLandmarks(mesh);
        expect(landmarks.elbowX).toBeGreaterThan(landmarks.shoulderX);
    });
});
