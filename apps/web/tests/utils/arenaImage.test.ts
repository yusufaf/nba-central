import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    ARENA_PHOTO_MAX_BYTES,
    COURT_LOGO_EDGE,
    encodeUnderLimit,
    fitLongEdge,
    resizeCourtLogo,
} from '@/utils/arenaImage';

describe('fitLongEdge', () => {
    it('scales the long edge down to 1600px and keeps the aspect ratio', () => {
        expect(fitLongEdge(4000, 3000)).toEqual({ width: 1600, height: 1200 });
        expect(fitLongEdge(3000, 4000)).toEqual({ width: 1200, height: 1600 });
        expect(fitLongEdge(5000, 1001)).toEqual({ width: 1600, height: 320 });
    });

    it('never scales a smaller image up', () => {
        expect(fitLongEdge(800, 600)).toEqual({ width: 800, height: 600 });
    });
});

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

describe('encodeUnderLimit', () => {
    it('keeps the first encode at quality 0.85 when it already fits', async () => {
        const encode = vi.fn(async () => blobOf(500 * 1024));

        const blob = await encodeUnderLimit(encode);

        expect(blob.size).toBe(500 * 1024);
        expect(encode.mock.calls).toEqual([[0.85]]);
    });

    it('steps the quality down until the photo is under 900 KB', async () => {
        const sizes: Record<string, number> = { '0.85': 2_000_000, '0.75': 1_200_000, '0.65': 900 * 1024 - 1 };
        const encode = vi.fn(async (quality: number) => blobOf(sizes[quality.toFixed(2)] ?? 0));

        const blob = await encodeUnderLimit(encode);

        expect(blob.size).toBe(900 * 1024 - 1);
        expect(encode.mock.calls.map(([q]) => q.toFixed(2))).toEqual(['0.85', '0.75', '0.65']);
        expect(blob.size).toBeLessThan(ARENA_PHOTO_MAX_BYTES);
    });

    it('gives up with a clear message rather than upload something too big', async () => {
        const encode = vi.fn(async () => blobOf(ARENA_PHOTO_MAX_BYTES));

        await expect(encodeUnderLimit(encode)).rejects.toThrow(
            "That photo couldn't be made small enough. Try a smaller image.",
        );
        expect(encode.mock.calls.at(-1)![0]).toBeGreaterThan(0.3);
    });

    it("fails when the browser can't encode at all", async () => {
        await expect(encodeUnderLimit(async () => null)).rejects.toThrow(
            "Your browser couldn't resize the image.",
        );
    });
});

describe('resizeCourtLogo', () => {
    const draw = (size: number) => {
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2000, height: 1000, close: vi.fn() })));
        const context = { drawImage: vi.fn(), fillRect: vi.fn() };
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
        const toBlob = vi
            .spyOn(HTMLCanvasElement.prototype, 'toBlob')
            .mockImplementation((done, type) => done(new Blob([new Uint8Array(size)], { type })));
        return { context, toBlob };
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('fits the long edge to 512px and stays a transparent PNG', async () => {
        const { context, toBlob } = draw(40_000);

        const blob = await resizeCourtLogo(new File(['x'], 'logo.png', { type: 'image/png' }));

        expect(COURT_LOGO_EDGE).toBe(512);
        expect(blob.type).toBe('image/png');
        expect(toBlob.mock.calls[0][1]).toBe('image/png');
        expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 256);
        // No background fill: the logo's transparency shows the paint behind it.
        expect(context.fillRect).not.toHaveBeenCalled();
    });

    it('refuses a logo that would still be over the limit', async () => {
        draw(ARENA_PHOTO_MAX_BYTES);
        await expect(resizeCourtLogo(new File(['x'], 'logo.png', { type: 'image/png' }))).rejects.toThrow(
            "That logo is too detailed to fit in 1 MB. Try a simpler image.",
        );
    });
});
