import { renderCardPng } from '@/composables/renderCardPng';
import ShareCard from '@/components/TeamBuilder/share/ShareCard.vue';
import type { ShareCardPlayer, ShareCardProps } from '@/components/TeamBuilder/share/ShareCard.vue';
import type { CourtDesign, PublicTeam } from '@/models/api';
import { centreLogoUrl } from '@/utils/court';

const STARTER_SLOTS = [1, 2, 3, 4, 5];

// The arena fields the card reads: a resolved arena, or a custom arena from
// the builder's live list.
export interface ShareCardArena {
    name: string;
    court?: CourtDesign | null;
    logoUrl?: string;
    drawingUrl?: string;
}

// Builds card props from either a saved/public team or the builder's live
// state serialised the same way (roster entries carry player snapshots).
// An arena without a court adds nothing, so those cards look as they did.
export const toShareCardProps = (
    team: Pick<PublicTeam, 'title' | 'city' | 'country' | 'logoUrl' | 'jerseyUrl' | 'username' | 'roster'> & {
        arena?: ShareCardArena | null;
    },
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
        ...courtProps(team.logoUrl, team.arena),
    };
};

const courtProps = (teamLogo: string, arena: ShareCardArena | null | undefined): Partial<ShareCardProps> => {
    if (!arena?.court) return {};
    return {
        court: arena.court,
        courtLogoUrl: centreLogoUrl(arena.court, { teamLogo, uploadedLogo: arena.logoUrl }),
        courtDrawingUrl: arena.drawingUrl,
        arenaName: arena.name,
    };
};

/**
 * Renders the 1200x630 share card off-screen and returns it as base64 PNG
 * (no data: prefix), ready for publishTeam's `cardPng`. Mounts a throwaway
 * Vue app: the card is pure props, so it needs neither the router nor Pinia.
 */
export const renderShareCard = async (props: ShareCardProps): Promise<string> =>
    (await renderCardPng(ShareCard, props as unknown as Record<string, unknown>)).replace(/^data:image\/png;base64,/, '');
