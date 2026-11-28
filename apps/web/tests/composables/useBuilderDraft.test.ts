import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import {
    DRAFT_MAX_AGE_MS,
    clearDraft,
    draftKeyFor,
    readDraft,
    resolveDraftKey,
    saveDraft,
    waitForDraftKey,
} from '@/composables/useBuilderDraft';
import type { SaveTeamPayload } from '@/models/api';

const team: SaveTeamPayload = {
    title: 'Dream Team',
    roster: [{ slot: 0, player: { id: 'jamesle01', fullName: 'LeBron James' } as never }],
    coach: null,
    gm: null,
    arena: null,
};

const GUEST = draftKeyFor(null);
const NOW = 1_800_000_000_000;

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('resolveDraftKey', () => {
    it('waits while Logto is still reading the session', () => {
        expect(resolveDraftKey({ isLoading: true, isAuthenticated: false, userId: null })).toBeNull();
    });

    it('uses the guest draft signed out', () => {
        expect(resolveDraftKey({ isLoading: false, isAuthenticated: false, userId: null })).toBe(GUEST);
    });

    it("waits for a signed-in user's id rather than falling back to the guest draft", () => {
        expect(resolveDraftKey({ isLoading: false, isAuthenticated: true, userId: null })).toBeNull();
    });

    it("uses the signed-in user's own draft", () => {
        expect(resolveDraftKey({ isLoading: false, isAuthenticated: true, userId: 'u1' })).toBe(draftKeyFor('u1'));
        expect(draftKeyFor('u1')).not.toBe(draftKeyFor('u2'));
    });
});

describe('waitForDraftKey', () => {
    it('resolves once the session and the user id have both arrived', async () => {
        const isLoading = ref(true);
        const isAuthenticated = ref(false);
        const userId = ref<string | null>(null);

        const key = waitForDraftKey({ isLoading, isAuthenticated }, userId);
        await nextTick();
        isAuthenticated.value = true;
        isLoading.value = false;
        await nextTick();
        userId.value = 'u1';

        expect(await key).toBe(draftKeyFor('u1'));
    });

    it('gives up rather than guessing when the user id never arrives', async () => {
        const key = await waitForDraftKey(
            { isLoading: ref(false), isAuthenticated: ref(true) },
            ref<string | null>(null),
            10,
        );
        expect(key).toBeNull();
    });
});

describe('the stored draft', () => {
    it('round-trips per key', () => {
        saveDraft(GUEST, team, NOW);
        expect(readDraft(GUEST, NOW)).toEqual(team);
        expect(readDraft(draftKeyFor('u1'), NOW)).toBeNull();
    });

    it('expires, and is removed once stale', () => {
        saveDraft(GUEST, team, NOW);
        expect(readDraft(GUEST, NOW + DRAFT_MAX_AGE_MS)).toEqual(team);
        expect(readDraft(GUEST, NOW + DRAFT_MAX_AGE_MS + 1)).toBeNull();
        expect(localStorage.getItem(GUEST)).toBeNull();
    });

    it('drops malformed or foreign-version entries', () => {
        localStorage.setItem(GUEST, '{not json');
        expect(readDraft(GUEST, NOW)).toBeNull();
        expect(localStorage.getItem(GUEST)).toBeNull();

        localStorage.setItem(GUEST, JSON.stringify({ version: 2, savedAt: NOW, team }));
        expect(readDraft(GUEST, NOW)).toBeNull();

        const duplicateSlots = { ...team, roster: [...team.roster, ...team.roster] };
        localStorage.setItem(GUEST, JSON.stringify({ version: 1, savedAt: NOW, team: duplicateSlots }));
        expect(readDraft(GUEST, NOW)).toBeNull();
    });

    it('clears', () => {
        saveDraft(GUEST, team, NOW);
        clearDraft(GUEST);
        expect(readDraft(GUEST, NOW)).toBeNull();
    });

    it('never throws when storage is full or blocked', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('full', 'QuotaExceededError');
        });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(() => saveDraft(GUEST, team, NOW)).not.toThrow();
        expect(readDraft(GUEST, NOW)).toBeNull();
        expect(() => clearDraft(GUEST)).not.toThrow();
    });
});
