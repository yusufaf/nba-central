import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOME_KIT, loadJerseyColours, sampleJerseyColours } from '@/three/character/jerseyColours';

type RGBA = [number, number, number, number];
const WHITE: RGBA = [255, 255, 255, 255];
const TEAL: RGBA = [15, 82, 87, 255];
const GOLD: RGBA = [201, 162, 39, 255];
const RED: RGBA = [200, 30, 40, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

const image = (size: number, paint: (x: number, y: number) => RGBA) => {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data.set(paint(x, y), (y * size + x) * 4);
    return { data, width: size, height: size };
};
const hex = ([r, g, b]: RGBA) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

describe('sampleJerseyColours', () => {
    it('finds a teal jersey with gold trim on a white template', () => {
        const jersey = image(20, (x, y) => {
            if (x < 3 || y < 3 || x > 16 || y > 16) return WHITE;
            return y === 10 || y === 11 ? GOLD : TEAL;
        });
        expect(sampleJerseyColours(jersey)).toMatchObject({ primary: hex(TEAL), secondary: hex(GOLD) });
    });

    it('ignores the background but keeps white inside the art', () => {
        const jersey = image(20, (x, y) => {
            if (x < 2 || y < 2 || x > 17 || y > 17) return WHITE;
            if (x === 2 || y === 2 || x === 17 || y === 17) return RED;
            return WHITE;
        });
        expect(sampleJerseyColours(jersey)).toMatchObject({ primary: hex(WHITE), secondary: hex(RED) });
    });

    it('gives null for a transparent image', () => {
        expect(sampleJerseyColours(image(10, () => CLEAR))).toBeNull();
    });

    it('picks a trim that contrasts with the primary', () => {
        const dark = sampleJerseyColours(image(10, () => TEAL));
        expect(dark?.trim).toBe('#ffffff');
    });
});

describe('loadJerseyColours', () => {
    afterEach(() => vi.unstubAllGlobals());

    const stubImage = (outcome: 'load' | 'error') =>
        vi.stubGlobal(
            'Image',
            class {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                crossOrigin = '';
                naturalWidth = 20;
                naturalHeight = 20;
                set src(_value: string) {
                    queueMicrotask(() => (outcome === 'load' ? this.onload?.() : this.onerror?.()));
                }
            },
        );

    it('falls back to the home kit without a jersey', async () => {
        await expect(loadJerseyColours(undefined)).resolves.toEqual(HOME_KIT);
    });

    it('falls back to the home kit when the image fails', async () => {
        stubImage('error');
        await expect(loadJerseyColours('https://cdn/jersey.png')).resolves.toEqual(HOME_KIT);
    });

    it('falls back to the home kit when the canvas is tainted', async () => {
        stubImage('load');
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage: () => {},
            getImageData: () => {
                throw new DOMException('tainted', 'SecurityError');
            },
        } as unknown as CanvasRenderingContext2D);
        await expect(loadJerseyColours('https://cdn/jersey.png')).resolves.toEqual(HOME_KIT);
    });
});
