import { beforeEach, describe, expect, it, vi } from 'vitest';

const toCanvas = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({ toCanvas }));

import { rasteriseCourt } from '@/three/arena/rasteriseCourt';

const canvasWith = (getImageData: () => unknown) => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue({ getImageData } as unknown as CanvasRenderingContext2D);
    return canvas;
};

describe('rasteriseCourt', () => {
    beforeEach(() => {
        toCanvas.mockReset();
    });

    it('returns the canvas when it can be read', async () => {
        const canvas = canvasWith(() => ({ data: new Uint8ClampedArray(4) }));
        toCanvas.mockResolvedValue(canvas);
        await expect(rasteriseCourt(document.createElement('div'))).resolves.toBe(canvas);
        expect(toCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), { pixelRatio: 2, cacheBust: true });
    });

    it('returns null when toCanvas throws', async () => {
        toCanvas.mockImplementation(async () => {
            throw new Error('image failed');
        });
        await expect(rasteriseCourt(document.createElement('div'))).resolves.toBeNull();
    });

    it('returns null when the canvas is tainted', async () => {
        toCanvas.mockResolvedValue(
            canvasWith(() => {
                throw new DOMException('tainted', 'SecurityError');
            }),
        );
        await expect(rasteriseCourt(document.createElement('div'))).resolves.toBeNull();
    });
});
