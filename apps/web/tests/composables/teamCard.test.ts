import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scene3d = vi.hoisted(() => ({ renderTeamPhoto: vi.fn() }));
vi.mock('@/components/scene3d', () => scene3d);

const webgl = vi.hoisted(() => ({ available: true }));
vi.mock('@/utils/webgl', () => ({ isWebGLAvailable: () => webgl.available }));

const shareCard = vi.hoisted(() => ({ renderShareCard: vi.fn() }));
vi.mock('@/composables/useShareCard', () => shareCard);

import { MAX_CARD_BYTES, renderTeamCard, resetPhotoCache } from '@/composables/teamCard';
import type { TeamPhotoInput } from '@/components/scene3d/teamPhotoInput';
import type { ShareCardProps } from '@/components/TeamBuilder/share/ShareCard.vue';

const card: ShareCardProps = {
    title: 'Owls',
    city: '',
    country: '',
    logoUrl: '',
    jerseyUrl: '',
    username: 'me',
    starters: [],
};

const photo = (teamName = 'Owls'): TeamPhotoInput => ({
    court: null,
    capacity: 18000,
    people: [{ id: 'player-1', name: 'A', role: 'player', heightInches: 75, weightPounds: 190 }],
    teamName,
});

const never = () => new Promise<string>(() => {});

beforeEach(() => {
    resetPhotoCache();
    webgl.available = true;
    scene3d.renderTeamPhoto.mockReset().mockResolvedValue('data:image/png;base64,PHOTO');
    shareCard.renderShareCard.mockReset().mockImplementation(async (props: ShareCardProps) =>
        props.background ? 'CARD3D' : 'CARD2D',
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('renderTeamCard', () => {
    it('renders the 2D card without asking for a photo', async () => {
        expect(await renderTeamCard('2d', card, photo())).toEqual({ png: 'CARD2D', rendered: '2d' });
        expect(scene3d.renderTeamPhoto).not.toHaveBeenCalled();
    });

    it('renders the 3D card with the photo behind it', async () => {
        expect(await renderTeamCard('3d', card, photo())).toEqual({ png: 'CARD3D', rendered: '3d' });
        expect(shareCard.renderShareCard).toHaveBeenCalledWith({ ...card, background: 'data:image/png;base64,PHOTO' });
    });

    it('reuses the photo for an unchanged scene', async () => {
        await renderTeamCard('3d', card, photo());
        await renderTeamCard('3d', card, photo());
        expect(scene3d.renderTeamPhoto).toHaveBeenCalledOnce();
    });

    it('renders again when the scene changes', async () => {
        await renderTeamCard('3d', card, photo());
        await renderTeamCard('3d', card, photo('Hawks'));
        expect(scene3d.renderTeamPhoto).toHaveBeenCalledTimes(2);
    });

    it('falls back to 2D when the photo fails, and tries again next time', async () => {
        scene3d.renderTeamPhoto.mockRejectedValueOnce(new Error('no GPU'));
        expect(await renderTeamCard('3d', card, photo())).toEqual({ png: 'CARD2D', rendered: '2d' });
        expect(await renderTeamCard('3d', card, photo())).toEqual({ png: 'CARD3D', rendered: '3d' });
        expect(scene3d.renderTeamPhoto).toHaveBeenCalledTimes(2);
    });

    it('falls back to 2D when the photo takes too long, then tries again', async () => {
        vi.useFakeTimers();
        scene3d.renderTeamPhoto.mockImplementationOnce(never);
        const first = renderTeamCard('3d', card, photo(), { timeoutMs: 1000 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(await first).toEqual({ png: 'CARD2D', rendered: '2d' });
        expect(await renderTeamCard('3d', card, photo(), { timeoutMs: 1000 })).toEqual({ png: 'CARD3D', rendered: '3d' });
        expect(scene3d.renderTeamPhoto).toHaveBeenCalledTimes(2);
    });

    it('keeps a photo that arrives after its timeout for the next save', async () => {
        vi.useFakeTimers();
        let resolveLate!: (url: string) => void;
        scene3d.renderTeamPhoto.mockImplementationOnce(() => new Promise<string>((resolve) => (resolveLate = resolve)));
        const first = renderTeamCard('3d', card, photo(), { timeoutMs: 1000 });
        await vi.advanceTimersByTimeAsync(1000);
        expect((await first).rendered).toBe('2d');
        resolveLate('data:image/png;base64,LATE');
        await vi.advanceTimersByTimeAsync(0);
        expect(await renderTeamCard('3d', card, photo(), { timeoutMs: 1000 })).toEqual({ png: 'CARD3D', rendered: '3d' });
        expect(scene3d.renderTeamPhoto).toHaveBeenCalledOnce();
    });

    it('falls back to 2D without WebGL, never asking for a photo', async () => {
        webgl.available = false;
        expect(await renderTeamCard('3d', card, photo())).toEqual({ png: 'CARD2D', rendered: '2d' });
        expect(scene3d.renderTeamPhoto).not.toHaveBeenCalled();
    });

    it('falls back to 2D when the 3D card is over 2 MB', async () => {
        const huge = 'A'.repeat(Math.ceil((MAX_CARD_BYTES + 3) * (4 / 3)));
        shareCard.renderShareCard.mockImplementation(async (props: ShareCardProps) => (props.background ? huge : 'CARD2D'));
        expect(await renderTeamCard('3d', card, photo())).toEqual({ png: 'CARD2D', rendered: '2d' });
    });

    it('gives no card when the 2D render fails too', async () => {
        shareCard.renderShareCard.mockRejectedValue(new Error('canvas tainted'));
        expect(await renderTeamCard('3d', card, photo())).toEqual({ png: null, rendered: null });
        expect(await renderTeamCard('2d', card, photo())).toEqual({ png: null, rendered: null });
    });
});
