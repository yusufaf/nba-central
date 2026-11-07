import { renderTeamPhoto } from '@/components/scene3d';
import { teamPhotoKey, type TeamPhotoInput } from '@/components/scene3d/teamPhotoInput';
import type { ShareCardProps } from '@/components/TeamBuilder/share/ShareCard.vue';
import { renderShareCard } from '@/composables/useShareCard';
import type { CardStyle } from '@/models/api';
import { isWebGLAvailable } from '@/utils/webgl';

// The same wait as the 3D view's own load timeout.
export const PHOTO_TIMEOUT_MS = 20_000;
// publishTeam refuses a larger card.
export const MAX_CARD_BYTES = 2 * 1024 * 1024;

type PhotoEntry = { key: string; frame: Promise<string> };

// The last team photo, kept while in flight too, so two quick saves of an
// unchanged scene share one render. Failures are never kept.
let lastPhoto: PhotoEntry | null = null;

const forget = (entry: PhotoEntry) => {
    if (lastPhoto === entry) lastPhoto = null;
};

const photoFor = (input: TeamPhotoInput): PhotoEntry => {
    const key = teamPhotoKey(input);
    if (lastPhoto?.key === key) return lastPhoto;
    const entry: PhotoEntry = { key, frame: renderTeamPhoto(input) };
    entry.frame.then(
        // A photo that lands after its save timed out still serves the next
        // save, unless a newer scene has taken the slot since.
        () => {
            if (lastPhoto === null) lastPhoto = entry;
        },
        () => forget(entry),
    );
    lastPhoto = entry;
    return entry;
};

const withTimeout = <T>(work: Promise<T>, ms: number, onTimeout: () => void): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            onTimeout();
            reject(new Error(`3D team photo took over ${ms} ms`));
        }, ms);
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
};

const decodedBytes = (base64: string) => Math.floor((base64.length * 3) / 4);

// The share card for a publish, as base64 PNG. A 3D card that can't be drawn
// here (no WebGL, a failed or slow render, too big) falls back to the 2D card
// for this publish only; `rendered` says which one came out.
export const renderTeamCard = async (
    style: CardStyle,
    card: ShareCardProps,
    photo: TeamPhotoInput,
    { timeoutMs = PHOTO_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<{ png: string | null; rendered: CardStyle | null }> => {
    if (style === '3d' && isWebGLAvailable()) {
        try {
            const entry = photoFor(photo);
            const background = await withTimeout(entry.frame, timeoutMs, () => forget(entry));
            const png = await renderShareCard({ ...card, background });
            if (decodedBytes(png) <= MAX_CARD_BYTES) return { png, rendered: '3d' };
            console.error(`3D share card is ${decodedBytes(png)} bytes; publishing the 2D card`);
        } catch (err) {
            console.error('3D share card failed; publishing the 2D card:', err);
        }
    }
    try {
        return { png: await renderShareCard(card), rendered: '2d' };
    } catch (err) {
        console.error('Share card render failed:', err);
        return { png: null, rendered: null };
    }
};

// Tests only.
export const resetPhotoCache = (): void => {
    lastPhoto = null;
};
