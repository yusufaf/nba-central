import { describe, it, expect, vi } from 'vitest';
import {
    ARENA_PHOTO_MAX_BYTES,
    encodeUnderLimit,
    fitLongEdge,
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
