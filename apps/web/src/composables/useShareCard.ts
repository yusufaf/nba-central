import { createApp, nextTick } from 'vue';
import { toPng } from 'html-to-image';
import ShareCard from '@/components/TeamBuilder/share/ShareCard.vue';
import type { ShareCardPlayer, ShareCardProps } from '@/components/TeamBuilder/share/ShareCard.vue';
import type { PublicTeam } from '@/models/api';

const STARTER_SLOTS = [1, 2, 3, 4, 5];

// Builds card props from either a saved/public team or the builder's live
// state serialised the same way (roster entries carry player snapshots).
export const toShareCardProps = (
    team: Pick<PublicTeam, 'title' | 'city' | 'country' | 'logoUrl' | 'jerseyUrl' | 'username' | 'roster'>,
): ShareCardProps => {
    const bySlot = new Map((team.roster ?? []).map((entry) => [entry.slot, entry.player]));
    const starters: ShareCardPlayer[] = STARTER_SLOTS.flatMap((slot) => {
        const player = bySlot.get(slot);
        if (!player) return [];
        return [{
            fullName: player.fullName,
            position: player.position,
            rating: player.rating ?? player.overallRating,
        }];
    });
    return {
        title: team.title,
        city: team.city,
        country: team.country,
        logoUrl: team.logoUrl,
        jerseyUrl: team.jerseyUrl,
        username: team.username,
        starters,
    };
};

const waitForImages = async (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
        images.map(
            (img) =>
                new Promise<void>((resolve) => {
                    if (img.complete) return resolve();
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                }),
        ),
    );
    // Let the component react to any @error swaps before exporting.
    await nextTick();
};

/**
 * Renders the 1200x630 share card off-screen and returns it as base64 PNG
 * (no data: prefix), ready for publishTeam's `cardPng`. Mounts a throwaway
 * Vue app: the card is pure props, so it needs neither the router nor Pinia.
 */
export const renderShareCard = async (props: ShareCardProps): Promise<string> => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-200rem';
    host.style.top = '0';
    document.body.appendChild(host);

    const app = createApp(ShareCard, props as unknown as Record<string, unknown>);
    try {
        const vm = app.mount(host);
        const el = vm.$el as HTMLElement;
        await waitForImages(el);
        const dataUrl = await toPng(el, { width: 1200, height: 630, pixelRatio: 1, cacheBust: true });
        return dataUrl.replace(/^data:image\/png;base64,/, '');
    } finally {
        app.unmount();
        host.remove();
    }
};
