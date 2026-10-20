import DailyEraShareCard from '@/components/DailyEra/DailyEraShareCard.vue';
import { renderCardPng } from '@/composables/renderCardPng';
import type { DailyEraShareResult } from '@/utils/dailyEraShare';

/**
 * The puzzle's crop as a data: URL, or null when it can't be fetched. Fetched
 * here, not by html-to-image: that one caches a failed fetch as an empty
 * image for the rest of the session. `no-store` skips the copy the game's
 * own <img> cached, which was loaded without CORS.
 */
export const imageAsDataUrl = async (url: string): Promise<string | null> => {
    try {
        const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn('Daily Era card: no puzzle image', err);
        return null;
    }
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, base64] = dataUrl.split(',', 2);
    const type = /^data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream';
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type });
};

/** The 1200x630 result card as a PNG. */
export const renderDailyEraCard = async (result: DailyEraShareResult, imageUrl: string): Promise<Blob> => {
    const crop = await imageAsDataUrl(imageUrl);
    return dataUrlToBlob(await renderCardPng(DailyEraShareCard, { result, imageUrl: crop }));
};
