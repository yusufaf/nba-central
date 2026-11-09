import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasTexture, MeshStandardMaterial } from 'three';
import { applyKitMaterial, kitTexture, type Landmarks } from '@/three/character/kit';
import { HOME_KIT } from '@/utils/jerseyColours';

const LANDMARKS: Landmarks = {
    hipY: 0.95,
    kneeY: 0.5,
    ankleY: 0.08,
    shoulderY: 1.45,
    neckY: 1.55,
    centreX: 0,
    shoulderX: 0.2,
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

    it('draws nothing for a suit', () => {
        const fillText = spyFillText();
        kitTexture({ kind: 'suit', teamName: 'Night Owls', number: '23', trim: '#ffffff', secondary: '#c9a227' });
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
