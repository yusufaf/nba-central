import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { findLiveArena, useCustomArenas } from '@/composables/useCustomArenas';
import type { CourtDesign, CustomArena, CustomArenaPayload } from '@/models/api';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('vue-sonner', () => ({ toast }));

vi.mock('@/composables/useCurrentUser', () => ({
    useCurrentUser: () => ({ currentUser: ref({ id: 'user-1', username: 'someone', memberSince: null }) }),
}));

// A stateful stub of the arena API: create and update store the item, the
// image endpoint stamps a URL on it, and list reads back what was stored.
const server = vi.hoisted(() => ({ arenas: new Map<string, Record<string, unknown>>() }));
const api = vi.hoisted(() => ({
    list: vi.fn(async () => ({ success: true, data: { customArenas: [...server.arenas.values()] } })),
    create: vi.fn(async (data: Record<string, unknown>) => {
        const arena = { ...data, arenaUUID: 'a1', created: '2026-10-03T00:00:00.000Z', isCustom: true };
        server.arenas.set('a1', arena);
        return { success: true, data: arena };
    }),
    update: vi.fn(async (arenaUUID: string, data: Record<string, unknown>) => {
        const arena = { ...server.arenas.get(arenaUUID), ...data };
        server.arenas.set(arenaUUID, arena);
        return { success: true, data: arena };
    }),
    uploadImage: vi.fn(async (arenaUUID: string, slot: string) => {
        const url = `https://cdn.example/arenas/${arenaUUID}/${slot}-1.png`;
        server.arenas.set(arenaUUID, { ...server.arenas.get(arenaUUID), [`${slot}Url`]: url });
        return { success: true, data: { url } };
    }),
    deleteImage: vi.fn(async (arenaUUID: string, slot: string) => {
        const { [`${slot}Url`]: _gone, ...rest } = server.arenas.get(arenaUUID) ?? {};
        server.arenas.set(arenaUUID, rest);
        return { success: true };
    }),
    delete: vi.fn(),
}));
vi.mock('@/network/api', () => ({ customArenaApi: api }));

const court: CourtDesign = {
    version: 1,
    wood: 'ebony',
    paint: '#c2410c',
    apron: '#111111',
    lines: '#f2f2f2',
    centerLogo: 'upload',
    baselineText: 'The Foundry',
    sidelineText: 'Est. 2026',
};

const payload: CustomArenaPayload = { name: 'The Foundry', location: '', capacity: 21000, openedYear: 2030, court };
const png = () => new Blob(['png'], { type: 'image/png' });

beforeEach(() => {
    server.arenas.clear();
    vi.clearAllMocks();
});

describe('useCustomArenas', () => {
    it('saves the court with the arena, uploads the centre logo, and reads both back', async () => {
        const { saveArena, customArenas } = useCustomArenas();
        await flushPromises();

        const saved = await saveArena(null, payload, { logo: png() });

        expect(api.create).toHaveBeenCalledWith(payload);
        expect(api.uploadImage).toHaveBeenCalledWith('a1', 'logo', expect.any(String));
        expect(api.uploadImage).not.toHaveBeenCalledWith('a1', 'photo', expect.anything());
        expect(saved?.court).toEqual(court);
        expect(saved?.logoUrl).toBe('https://cdn.example/arenas/a1/logo-1.png');
        expect(customArenas.value[0].court).toEqual(court);
        expect(toast.success).toHaveBeenCalledWith('Created The Foundry');
    });

    it('updates a court in place and removes the logo when asked', async () => {
        server.arenas.set('a1', { ...payload, arenaUUID: 'a1', logoUrl: 'https://cdn.example/old.png', isCustom: true });
        const { saveArena } = useCustomArenas();
        await flushPromises();

        const changed = { ...payload, court: { ...court, wood: 'walnut' as const, centerLogo: 'none' as const } };
        const saved = await saveArena('a1', changed, { logo: null });

        expect(api.update).toHaveBeenCalledWith('a1', changed);
        expect(api.deleteImage).toHaveBeenCalledWith('a1', 'logo');
        expect(saved?.court?.wood).toBe('walnut');
        expect(saved?.logoUrl).toBeUndefined();
    });

    it('leaves both images alone when neither changed', async () => {
        const { saveArena } = useCustomArenas();
        await flushPromises();
        await saveArena(null, payload, {});
        expect(api.uploadImage).not.toHaveBeenCalled();
        expect(api.deleteImage).not.toHaveBeenCalled();
    });

    it('uploads the drawing after the arena, as a PNG, and reads it back', async () => {
        const { saveArena, customArenas } = useCustomArenas();
        await flushPromises();

        const saved = await saveArena(null, payload, { drawing: png() });

        expect(api.create.mock.invocationCallOrder[0]).toBeLessThan(api.uploadImage.mock.invocationCallOrder[0]);
        expect(api.uploadImage).toHaveBeenCalledWith('a1', 'drawing', btoa('png'));
        expect(saved?.drawingUrl).toBe('https://cdn.example/arenas/a1/drawing-1.png');
        expect(customArenas.value[0].drawingUrl).toBe(saved?.drawingUrl);
    });

    it('deletes the drawing slot when the drawing is cleared, and leaves it alone when unchanged', async () => {
        server.arenas.set('a1', { ...payload, arenaUUID: 'a1', drawingUrl: 'https://cdn.example/d.png', isCustom: true });
        const { saveArena } = useCustomArenas();
        await flushPromises();

        const kept = await saveArena('a1', payload, { photo: undefined, logo: undefined, drawing: undefined });
        expect(api.uploadImage).not.toHaveBeenCalled();
        expect(api.deleteImage).not.toHaveBeenCalled();
        expect(kept?.drawingUrl).toBe('https://cdn.example/d.png');

        const cleared = await saveArena('a1', payload, { drawing: null });
        expect(api.deleteImage).toHaveBeenCalledWith('a1', 'drawing');
        expect(cleared?.drawingUrl).toBeUndefined();
    });

    it('keeps the arena and says so when the drawing upload fails', async () => {
        api.uploadImage.mockResolvedValueOnce({ success: false, error: 'Drawing must be under 1 MB' } as never);
        const { saveArena } = useCustomArenas();
        await flushPromises();

        const saved = await saveArena(null, payload, { drawing: png() });

        expect(saved?.arenaUUID).toBe('a1');
        expect(toast.error).toHaveBeenCalledWith("The arena was saved, but its drawing wasn't: Drawing must be under 1 MB");
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('keeps the arena and says so when the logo upload fails', async () => {
        api.uploadImage.mockResolvedValueOnce({ success: false, error: 'Image must be under 1 MB' } as never);
        const { saveArena } = useCustomArenas();
        await flushPromises();

        const saved = await saveArena(null, payload, { logo: png() });

        expect(saved?.arenaUUID).toBe('a1');
        expect(toast.error).toHaveBeenCalledWith("The arena was saved, but its centre logo wasn't: Image must be under 1 MB");
        expect(toast.success).not.toHaveBeenCalled();
    });
});

describe('findLiveArena', () => {
    const list = [{ arenaUUID: 'a1', name: 'Live' }] as CustomArena[];

    it('finds the linked arena in your own list, and nothing for anything else', () => {
        expect(findLiveArena({ name: 'Stale', arenaUUID: 'a1', isCustom: true }, list)?.name).toBe('Live');
        expect(findLiveArena({ name: 'Theirs', arenaUUID: 'zz', isCustom: true }, list)).toBeNull();
        expect(findLiveArena({ name: 'United Center' }, list)).toBeNull();
        expect(findLiveArena(null, list)).toBeNull();
    });
});
