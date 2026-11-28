import { until } from '@vueuse/core';
import type { Ref } from 'vue';
import type { SaveTeamPayload } from '@/models/api';
import { isSaveTeamPayload } from '@/utils/teamPayload';

/*
 * The team on the builder that hasn't been saved yet, kept so that leaving
 * /teambuilder (the builder has no KeepAlive, and a bare visit starts a new
 * team) doesn't throw it away. One per person: the key carries the account,
 * so a signed-in draft, which can hold that account's custom players, is
 * never offered to a guest or to another account on the same browser.
 *
 * localStorage, unlike the pending save: this is about coming back later,
 * not about one trip to Logto. Best effort throughout, never a toast: a
 * blocked or full storage only means the team isn't kept.
 */

const KEY_PREFIX = 'nba-central:builder-draft:';
const GUEST = 'guest';
const VERSION = 1;

export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface StoredDraft {
    version: number;
    savedAt: number;
    team: SaveTeamPayload;
}

export interface DraftAuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    /** The account's id once Logto's claims have been read; null before then and signed out. */
    userId: string | null;
}

/**
 * Which draft the builder may read or write right now, or null when that
 * can't be told yet.
 */
export const resolveDraftKey = ({ isLoading, isAuthenticated, userId }: DraftAuthState): string | null => {
    // While Logto reads the stored session, isAuthenticated is false for
    // everyone, so a signed-in team written now would land under the guest key.
    if (isLoading) return null;
    if (!isAuthenticated) return draftKeyFor(null);
    // Signed in, but the claims aren't read yet: whose draft it is isn't known.
    return userId ? draftKeyFor(userId) : null;
};

/** resolveDraftKey, once Logto and the account's claims have settled. */
export const waitForDraftKey = async (
    auth: { isLoading: Readonly<Ref<boolean>>; isAuthenticated: Readonly<Ref<boolean>> },
    userId: Readonly<Ref<string | null>>,
    timeoutMs = 5000,
): Promise<string | null> => {
    if (auth.isLoading.value) await until(auth.isLoading).toBe(false);
    if (auth.isAuthenticated.value && !userId.value) {
        await until(userId).toBeTruthy({ timeout: timeoutMs });
    }
    return resolveDraftKey({
        isLoading: auth.isLoading.value,
        isAuthenticated: auth.isAuthenticated.value,
        userId: userId.value,
    });
};

export const draftKeyFor = (userId: string | null): string => KEY_PREFIX + (userId ?? GUEST);

export const saveDraft = (key: string, team: SaveTeamPayload, now = Date.now()): void => {
    try {
        localStorage.setItem(key, JSON.stringify({ version: VERSION, savedAt: now, team } satisfies StoredDraft));
    } catch {
        // Full or blocked: the team just isn't kept.
    }
};

export const clearDraft = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Nothing to clear if storage is blocked.
    }
};

/** The kept team, or null. Anything stale or malformed is removed. */
export const readDraft = (key: string, now = Date.now()): SaveTeamPayload | null => {
    let raw: string | null;
    try {
        raw = localStorage.getItem(key);
    } catch {
        return null;
    }
    if (!raw) return null;

    let stored: Partial<StoredDraft> | null = null;
    try {
        stored = JSON.parse(raw);
    } catch {
        // Falls through to the removal below.
    }
    const fresh =
        typeof stored === 'object' &&
        stored !== null &&
        stored.version === VERSION &&
        typeof stored.savedAt === 'number' &&
        stored.savedAt <= now &&
        now - stored.savedAt <= DRAFT_MAX_AGE_MS &&
        isSaveTeamPayload(stored.team);
    if (!fresh) {
        clearDraft(key);
        return null;
    }
    return stored!.team as SaveTeamPayload;
};
