import type { RouteLocationRaw } from 'vue-router';
import type { SaveTeamPayload } from '@/models/api';

/*
 * A team built signed out has to survive a full-page trip to Logto and back,
 * which wipes the builder. Save stashes the team here first; Callback.vue
 * sends the user to /teambuilder?resume=save, and the builder restores it and
 * saves it. The draft stays until a save succeeds, so a failed save followed
 * by a refresh can try again.
 *
 * sessionStorage, not localStorage: the trip happens in one tab, and a
 * draft left behind should not outlive it. It also expires, and the builder
 * discards it when you return without resuming, so a team you walked away
 * from can't be saved by an unrelated sign-in later. It is also dropped when
 * the app loads anywhere but /callback or a ?resume=save URL: the ways back
 * from Logto, and from a refresh while the save is being retried.
 */

const STORAGE_KEY = 'nba-central:pending-save';

// Long enough to register an account and verify an email.
export const PENDING_SAVE_MAX_AGE_MS = 30 * 60 * 1000;

export const RESUME_SAVE_QUERY = 'save';

interface PendingSave {
    savedAt: number;
    team: SaveTeamPayload;
}

// Every saved player is a snapshot with a fullName, built-in or custom.
const isRosterEntry = (entry: unknown): boolean => {
    if (typeof entry !== 'object' || entry === null) return false;
    const { slot, player } = entry as { slot?: unknown; player?: { fullName?: unknown } | null };
    return (
        Number.isInteger(slot) &&
        (slot as number) >= 0 &&
        typeof player === 'object' &&
        player !== null &&
        typeof player.fullName === 'string'
    );
};

const parse = (raw: string | null, now: number): SaveTeamPayload | null => {
    if (!raw) return null;
    let stored: Partial<PendingSave> | null;
    try {
        stored = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof stored !== 'object' || stored === null) return null;

    const { savedAt, team } = stored;
    if (typeof savedAt !== 'number' || now - savedAt > PENDING_SAVE_MAX_AGE_MS || savedAt > now) {
        return null;
    }
    if (typeof team !== 'object' || team === null) return null;
    if (typeof team.title !== 'string' || !Array.isArray(team.roster)) return null;
    if (!team.roster.every(isRosterEntry)) return null;
    const slots = team.roster.map((entry) => entry.slot);
    if (new Set(slots).size !== slots.length) return null;
    return team;
};

const read = (): string | null => {
    try {
        return sessionStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
};

const clear = () => {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing to clear if storage is blocked.
    }
};

/** False when storage is blocked, so the caller can say the team won't survive. */
export const stashPendingSave = (team: SaveTeamPayload, now = Date.now()): boolean => {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: now, team } satisfies PendingSave));
        return true;
    } catch {
        return false;
    }
};

/** Whether a fresh, well-formed draft is waiting. Leaves it in place. */
export const hasPendingSave = (now = Date.now()): boolean => parse(read(), now) !== null;

/**
 * The waiting draft, left in place until a save succeeds. Anything stale or
 * malformed comes back as null and is removed.
 */
export const readPendingSave = (now = Date.now()): SaveTeamPayload | null => {
    const team = parse(read(), now);
    if (!team) clear();
    return team;
};

export const discardPendingSave = clear;

/**
 * Run once as the app loads. The way back from Logto lands on /callback, and
 * a refresh while the save is being retried lands on ?resume=save. A load
 * anywhere else means the sign-in was abandoned, and its draft must not be
 * saved by whatever sign-in comes next.
 */
export const discardAbandonedPendingSave = ({ pathname, search }: { pathname: string; search: string }) => {
    const resuming = new URLSearchParams(search).get('resume') === RESUME_SAVE_QUERY;
    if (pathname !== '/callback' && !resuming) clear();
};

/** Where Callback.vue sends the user once they are signed in. */
export const signInReturnRoute = (now = Date.now()): RouteLocationRaw =>
    hasPendingSave(now) ? { path: '/teambuilder', query: { resume: RESUME_SAVE_QUERY } } : '/';
