import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/composables/renderCardPng', () => ({
    renderCardPng: vi.fn(async () => 'data:image/png;base64,QUJD'),
}));

import { renderCardPng } from '@/composables/renderCardPng';
import DailyEraShareCard from '@/components/DailyEra/DailyEraShareCard.vue';
import { dataUrlToBlob, imageAsDataUrl, renderDailyEraCard } from '@/components/DailyEra/dailyEraCard';
import { dailyEraShareResult } from '@/utils/dailyEraShare';
import { solvedGame } from '../helpers/dailyEraShare';

const CROP_URL = 'https://cdn.example/daily-era/abc.webp';
const okCrop = () =>
    vi.fn(async () => new Response('img', { status: 200, headers: { 'Content-Type': 'image/jpeg' } }));

afterEach(() => vi.unstubAllGlobals());

describe('imageAsDataUrl', () => {
    it('fetches the crop with CORS, bypassing the cache, as a data URL', async () => {
        const fetch = okCrop();
        vi.stubGlobal('fetch', fetch);
        await expect(imageAsDataUrl(CROP_URL)).resolves.toMatch(/^data:image\/jpeg;base64,/);
        expect(fetch).toHaveBeenCalledWith(CROP_URL, { mode: 'cors', cache: 'no-store' });
    });

    it('gives null for a failed response or a network error', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
        await expect(imageAsDataUrl(CROP_URL)).resolves.toBeNull();
        vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
        await expect(imageAsDataUrl(CROP_URL)).resolves.toBeNull();
    });
});

describe('dataUrlToBlob', () => {
    it('decodes the bytes and keeps the type', async () => {
        const blob = dataUrlToBlob('data:image/png;base64,QUJD');
        expect(blob.type).toBe('image/png');
        await expect(blob.text()).resolves.toBe('ABC');
    });
});

describe('renderDailyEraCard', () => {
    const result = dailyEraShareResult(solvedGame, 2);

    it('renders the card from plain values with the inlined crop', async () => {
        vi.stubGlobal('fetch', okCrop());
        const blob = await renderDailyEraCard(result, CROP_URL);
        expect(blob.type).toBe('image/png');
        expect(renderCardPng).toHaveBeenLastCalledWith(DailyEraShareCard, {
            result: expect.objectContaining({ puzzleNumber: 12 }),
            imageUrl: expect.stringMatching(/^data:/),
        });
    });

    it('renders without the crop when it cannot be fetched', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
        await renderDailyEraCard(result, CROP_URL);
        expect(renderCardPng).toHaveBeenLastCalledWith(DailyEraShareCard, { result, imageUrl: null });
    });
});
