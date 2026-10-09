import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    PENDING_SAVE_MAX_AGE_MS,
    discardAbandonedPendingSave,
    discardPendingSave,
    hasPendingSave,
    readPendingSave,
    signInReturnRoute,
    stashPendingSave,
} from '@/composables/usePendingSave';
import type { SaveTeamPayload } from '@/models/api';

const KEY = 'nba-central:pending-save';

const team = (overrides: Partial<SaveTeamPayload> = {}): SaveTeamPayload => ({
    title: 'Dream Team',
    description: 'Custom NBA Team',
    roster: [{ slot: 0, player: { id: 'jamesle01', fullName: 'LeBron James' } as never }],
    coach: null,
    gm: null,
    arena: null,
    ...overrides,
});

const writeRaw = (value: unknown) => sessionStorage.setItem(KEY, JSON.stringify(value));

beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
});

describe('pending save', () => {
    it('round-trips a team, and keeps it until it is discarded so a failed save can retry', () => {
        expect(stashPendingSave(team())).toBe(true);

        expect(readPendingSave()).toEqual(team());
        expect(readPendingSave()).toEqual(team());
        expect(hasPendingSave()).toBe(true);
    });

    it('expires, and an expired draft is removed when read', () => {
        const now = 1_000_000;
        stashPendingSave(team(), now);

        expect(hasPendingSave(now + PENDING_SAVE_MAX_AGE_MS)).toBe(true);
        expect(readPendingSave(now + PENDING_SAVE_MAX_AGE_MS + 1)).toBeNull();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('ignores a draft stamped in the future', () => {
        stashPendingSave(team(), 5_000);

        expect(readPendingSave(1_000)).toBeNull();
    });

    it.each([
        ['not JSON', '{nope'],
        ['null', 'null'],
        ['no timestamp', JSON.stringify({ team: team() })],
        ['no team', JSON.stringify({ savedAt: Date.now() })],
        ['a roster that is not a list', JSON.stringify({ savedAt: Date.now(), team: { title: 'x', roster: {} } })],
        ['a roster entry without a player', JSON.stringify({ savedAt: Date.now(), team: { title: 'x', roster: [{ slot: 0 }] } })],
        ['a roster entry without a slot', JSON.stringify({ savedAt: Date.now(), team: { title: 'x', roster: [{ player: { fullName: 'A' } }] } })],
        ['a player without a name', JSON.stringify({ savedAt: Date.now(), team: { title: 'x', roster: [{ slot: 0, player: { id: 'a' } }] } })],
        ['a negative slot', JSON.stringify({ savedAt: Date.now(), team: { title: 'x', roster: [{ slot: -1, player: { fullName: 'A' } }] } })],
        ['two players in one slot', JSON.stringify({ savedAt: Date.now(), team: { title: 'x', roster: [{ slot: 2, player: { fullName: 'A' } }, { slot: 2, player: { fullName: 'B' } }] } })],
    ])('treats %s as no draft and clears it', (_label, raw) => {
        sessionStorage.setItem(KEY, raw);

        expect(hasPendingSave()).toBe(false);
        expect(readPendingSave()).toBeNull();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('accepts an empty roster: Save has never required players', () => {
        writeRaw({ savedAt: Date.now(), team: team({ roster: [] }) });

        expect(readPendingSave()).toEqual(team({ roster: [] }));
    });

    it('discards on request', () => {
        stashPendingSave(team());
        discardPendingSave();

        expect(hasPendingSave()).toBe(false);
    });

    it('reports blocked storage instead of throwing', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(stashPendingSave(team())).toBe(false);
    });

    it('reads as no draft when storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(hasPendingSave()).toBe(false);
        expect(readPendingSave()).toBeNull();
    });
});

describe('discardAbandonedPendingSave', () => {
    it('keeps the draft when the app loads on the way back from sign-in', () => {
        stashPendingSave(team());

        discardAbandonedPendingSave({ pathname: '/callback', search: '?code=abc&state=xyz' });

        expect(hasPendingSave()).toBe(true);
    });

    it('keeps the draft on a refresh while the save is being retried', () => {
        stashPendingSave(team());

        discardAbandonedPendingSave({ pathname: '/teambuilder', search: '?resume=save' });

        expect(hasPendingSave()).toBe(true);
    });

    it.each([
        ['/', ''],
        ['/teambuilder', ''],
        ['/teambuilder', '?remix=src-1'],
        ['/teambuilder', '?resume=nope'],
        ['/login', ''],
        ['/settings', ''],
    ])('drops it when the app loads on %s%s', (pathname, search) => {
        stashPendingSave(team());

        discardAbandonedPendingSave({ pathname, search });

        expect(hasPendingSave()).toBe(false);
    });
});

describe('signInReturnRoute', () => {
    it('goes home when nothing is waiting', () => {
        expect(signInReturnRoute()).toBe('/');
    });

    it('goes back to the builder to finish the save when a draft is waiting', () => {
        stashPendingSave(team());

        expect(signInReturnRoute()).toEqual({ path: '/teambuilder', query: { resume: 'save' } });
    });

    it('goes home when the waiting draft has expired', () => {
        stashPendingSave(team(), 1_000);

        expect(signInReturnRoute(1_000 + PENDING_SAVE_MAX_AGE_MS + 1)).toBe('/');
    });
});
