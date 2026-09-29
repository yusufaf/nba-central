import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/network/api', () => ({
    settingsApi: {
        get: vi.fn(),
        update: vi.fn(),
        initialize: vi.fn(),
    },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));

import { settingsApi } from '@/network/api';
import { toast } from 'vue-sonner';
import { settingsSync, useSettingsSync } from '@/composables/useSettingsSync';
import { usePlayerStatsPreferences } from '@/composables/usePlayerStatsPreferences';
import { useScoresPreferences } from '@/composables/useScoresPreferences';

const PLAYER_STATS_KEY = 'nba-player-stats-preferences';
const SCORES_KEY = 'nba-scores-preferences';

const serverHas = (settings: Record<string, unknown>, updatedAt: string | null = '2026-09-01T00:00:00.000Z') =>
    vi.mocked(settingsApi.get).mockResolvedValue({
        success: true,
        data: { settings, updatedAt },
    });

const echo = async (settings: Record<string, unknown>) => ({
    success: true as const,
    data: { settings, updatedAt: '2026-09-28T00:00:00.000Z' },
});

const updateSucceeds = () => {
    vi.mocked(settingsApi.update).mockImplementation(echo);
    vi.mocked(settingsApi.initialize).mockImplementation(echo);
};

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

type UpdateResult = Awaited<ReturnType<typeof settingsApi.update>>;
type GetResult = Awaited<ReturnType<typeof settingsApi.get>>;

const storedJson = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');

beforeEach(() => {
    settingsSync.stop();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(settingsApi.get).mockReset();
    vi.mocked(settingsApi.update).mockReset();
    vi.mocked(settingsApi.initialize).mockReset();
});

describe('signed out', () => {
    it('reads and writes localStorage and never calls the API', async () => {
        localStorage.setItem(SCORES_KEY, JSON.stringify({ hideScores: true }));

        const { preferences } = useScoresPreferences();
        expect(preferences.value.hideScores).toBe(true);
        expect(preferences.value.conferenceFilter).toBe('ALL');

        preferences.value.conferenceFilter = 'EAST';
        await flushPromises();

        expect(storedJson(SCORES_KEY).conferenceFilter).toBe('EAST');
        expect(settingsApi.get).not.toHaveBeenCalled();
        expect(settingsApi.update).not.toHaveBeenCalled();
    });
});

describe('signed in', () => {
    it('shows the server values over local ones once loaded', async () => {
        localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify({ statMode: 'per_game' }));
        serverHas({ 'playerStats.statMode': 'totals' });

        const { preferences } = usePlayerStatsPreferences();
        await settingsSync.start('user-1');

        expect(preferences.value.statMode).toBe('totals');
        // Keys the server doesn't have yet fall back to the defaults.
        expect(preferences.value.seasonFormat).toBe('YYYY-YY');
        expect(useSettingsSync().status.value).toBe('ready');
    });

    it('loads once per session for the same user', async () => {
        serverHas({});

        await Promise.all([settingsSync.start('user-1'), settingsSync.start('user-1')]);
        await settingsSync.start('user-1');

        expect(settingsApi.get).toHaveBeenCalledTimes(1);
    });

    it('reloads when a different user signs in', async () => {
        serverHas({ 'scores.hideScores': true });
        await settingsSync.start('user-1');

        serverHas({ 'scores.hideScores': false });
        await settingsSync.start('user-2');

        expect(settingsApi.get).toHaveBeenCalledTimes(2);
        expect(useScoresPreferences().preferences.value.hideScores).toBe(false);
    });

    it('saves a changed field to the server, not to localStorage', async () => {
        serverHas({});
        updateSucceeds();
        await settingsSync.start('user-1');

        const { preferences } = useScoresPreferences();
        preferences.value.hideFinishedGames = true;
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledTimes(1);
        expect(settingsApi.update).toHaveBeenCalledWith({ 'scores.hideFinishedGames': true });
        // useStorage still writes its defaults, but the change stays off it.
        expect(storedJson(SCORES_KEY).hideFinishedGames).toBe(false);
        expect(preferences.value.hideFinishedGames).toBe(true);
    });

    it('shares one value across every instance', async () => {
        serverHas({});
        updateSucceeds();
        await settingsSync.start('user-1');

        const first = useScoresPreferences();
        const second = useScoresPreferences();
        first.preferences.value.selectedView = 'List';
        await nextTick();

        expect(second.preferences.value.selectedView).toBe('List');
    });

    it('flags the field as saving until the request settles', async () => {
        serverHas({});
        await settingsSync.start('user-1');
        const pending = deferred<UpdateResult>();
        vi.mocked(settingsApi.update).mockReturnValue(pending.promise);

        const { isSaving } = useSettingsSync();
        const { preferences } = usePlayerStatsPreferences();
        preferences.value.showCareerSummary = false;
        await flushPromises();

        expect(isSaving('playerStats.showCareerSummary')).toBe(true);
        expect(isSaving('playerStats.statMode')).toBe(false);

        pending.resolve({ success: true, data: { settings: {}, updatedAt: 'x' } });
        await flushPromises();

        expect(isSaving('playerStats.showCareerSummary')).toBe(false);
    });

    it('sends every field a reset changes in one request', async () => {
        serverHas({ 'playerStats.statMode': 'totals', 'playerStats.highlightCareerHighs': false });
        updateSucceeds();
        await settingsSync.start('user-1');

        usePlayerStatsPreferences().resetPreferences();
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledTimes(1);
        expect(settingsApi.update).toHaveBeenCalledWith({
            'playerStats.statMode': 'per_game',
            'playerStats.highlightCareerHighs': true,
        });
    });

    it('never sends a value the server would reject', async () => {
        serverHas({});
        updateSucceeds();
        await settingsSync.start('user-1');

        const { preferences } = useScoresPreferences();
        preferences.value.conferenceFilter = '';
        await flushPromises();

        expect(settingsApi.update).not.toHaveBeenCalled();
        expect(preferences.value.conferenceFilter).toBe('ALL');
    });
});

describe('a failed save', () => {
    it('reverts the field and shows a toast when the request throws', async () => {
        serverHas({ 'scores.useShortNames': true });
        await settingsSync.start('user-1');
        vi.mocked(settingsApi.update).mockRejectedValue(new Error('Network Error'));

        const { preferences } = useScoresPreferences();
        preferences.value.useShortNames = false;
        await flushPromises();

        expect(preferences.value.useShortNames).toBe(true);
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(useSettingsSync().isSaving('scores.useShortNames')).toBe(false);
    });

    it('reverts when the API answers success: false', async () => {
        serverHas({});
        await settingsSync.start('user-1');
        vi.mocked(settingsApi.update).mockResolvedValue({ success: false, error: 'Invalid value' });

        const { preferences } = usePlayerStatsPreferences();
        preferences.value.seasonFormat = 'YYYY';
        await flushPromises();

        expect(preferences.value.seasonFormat).toBe('YYYY-YY');
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it('reverts to the last value the server accepted, not the default', async () => {
        serverHas({});
        await settingsSync.start('user-1');
        const { preferences } = useScoresPreferences();

        updateSucceeds();
        preferences.value.conferenceFilter = 'WEST';
        await flushPromises();

        vi.mocked(settingsApi.update).mockRejectedValue(new Error('down'));
        preferences.value.conferenceFilter = 'EAST';
        await flushPromises();

        expect(preferences.value.conferenceFilter).toBe('WEST');
    });

    it('keeps a newer change when an older save of the field fails', async () => {
        serverHas({});
        await settingsSync.start('user-1');
        const first = deferred<UpdateResult>();
        vi.mocked(settingsApi.update).mockReturnValueOnce(first.promise);

        const { preferences } = useScoresPreferences();
        preferences.value.hideScores = true;
        await flushPromises();
        preferences.value.hideScores = false;
        await flushPromises();

        first.reject(new Error('slow and failed'));
        await flushPromises();

        // The server never took `true`, so `false` already matches it.
        expect(settingsApi.update).toHaveBeenCalledTimes(1);
        expect(preferences.value.hideScores).toBe(false);
        expect(toast.error).not.toHaveBeenCalled();
    });
});

describe('saving one field twice in a row', () => {
    it('waits for the first save before sending the second, so they arrive in order', async () => {
        serverHas({});
        await settingsSync.start('user-1');
        const first = deferred<UpdateResult>();
        vi.mocked(settingsApi.update)
            .mockReturnValueOnce(first.promise)
            .mockImplementation(echo);

        const { preferences } = useScoresPreferences();
        preferences.value.hideScores = true;
        await flushPromises();
        preferences.value.hideScores = false;
        await flushPromises();
        expect(settingsApi.update).toHaveBeenCalledTimes(1);

        first.resolve({ success: true, data: { settings: {}, updatedAt: 'x' } });
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledTimes(2);
        expect(settingsApi.update).toHaveBeenLastCalledWith({ 'scores.hideScores': false });
        expect(preferences.value.hideScores).toBe(false);
    });

    it('sends only the latest of several queued changes', async () => {
        serverHas({});
        await settingsSync.start('user-1');
        const first = deferred<UpdateResult>();
        vi.mocked(settingsApi.update)
            .mockReturnValueOnce(first.promise)
            .mockImplementation(echo);

        const { preferences } = useScoresPreferences();
        preferences.value.conferenceFilter = 'EAST';
        await flushPromises();
        preferences.value.conferenceFilter = 'WEST';
        preferences.value.conferenceFilter = 'CROSS';
        await flushPromises();

        first.resolve({ success: true, data: { settings: {}, updatedAt: 'x' } });
        await flushPromises();

        expect(vi.mocked(settingsApi.update).mock.calls).toEqual([
            [{ 'scores.conferenceFilter': 'EAST' }],
            [{ 'scores.conferenceFilter': 'CROSS' }],
        ]);
    });

    it('does not hold back a different field', async () => {
        serverHas({});
        await settingsSync.start('user-1');
        vi.mocked(settingsApi.update)
            .mockReturnValueOnce(deferred<UpdateResult>().promise)
            .mockImplementation(echo);

        const { preferences } = useScoresPreferences();
        preferences.value.hideScores = true;
        await flushPromises();
        preferences.value.useShortNames = false;
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledTimes(2);
        expect(settingsApi.update).toHaveBeenLastCalledWith({ 'scores.useShortNames': false });
    });
});

describe('first sign-in migration', () => {
    it('uploads local values once when the server has never stored settings', async () => {
        localStorage.setItem(
            PLAYER_STATS_KEY,
            JSON.stringify({ seasonFormat: 'YYYY', statMode: 'totals', showCareerSummary: false, highlightCareerHighs: true }),
        );
        localStorage.setItem(
            SCORES_KEY,
            // A stale or hand-edited value is left behind rather than sent
            // for the server to reject the whole migration over.
            JSON.stringify({ conferenceFilter: 'NORTH', hideScores: true, retired: 1 }),
        );
        serverHas({}, null);
        updateSucceeds();

        await settingsSync.start('user-1');

        expect(settingsApi.initialize).toHaveBeenCalledTimes(1);
        expect(settingsApi.update).not.toHaveBeenCalled();
        expect(settingsApi.initialize).toHaveBeenCalledWith({
            'playerStats.seasonFormat': 'YYYY',
            'playerStats.statMode': 'totals',
            'playerStats.showCareerSummary': false,
            'playerStats.highlightCareerHighs': true,
            'scores.hideScores': true,
        });
        const { preferences } = usePlayerStatsPreferences();
        expect(preferences.value.seasonFormat).toBe('YYYY');
        expect(useScoresPreferences().preferences.value.hideScores).toBe(true);
    });

    it('still marks the account as migrated when there is nothing local', async () => {
        serverHas({}, null);
        updateSucceeds();

        await settingsSync.start('user-1');

        expect(settingsApi.initialize).toHaveBeenCalledWith({});
    });

    it('never migrates again once the server has settings', async () => {
        localStorage.setItem(SCORES_KEY, JSON.stringify({ hideScores: true }));
        serverHas({ 'scores.hideScores': false });

        await settingsSync.start('user-1');

        expect(settingsApi.initialize).not.toHaveBeenCalled();
        expect(useScoresPreferences().preferences.value.hideScores).toBe(false);
    });

    it('does not trigger a save of the migrated values', async () => {
        localStorage.setItem(SCORES_KEY, JSON.stringify({ hideScores: true }));
        serverHas({}, null);
        updateSucceeds();

        await settingsSync.start('user-1');
        await flushPromises();

        expect(settingsApi.initialize).toHaveBeenCalledTimes(1);
        expect(settingsApi.update).not.toHaveBeenCalled();
    });

    it('takes the settings another device uploaded first', async () => {
        localStorage.setItem(SCORES_KEY, JSON.stringify({ hideScores: true }));
        serverHas({}, null);
        // The server's create-only write lost the race and returned what the
        // other device stored.
        vi.mocked(settingsApi.initialize).mockResolvedValue({
            success: true,
            data: { settings: { 'scores.hideScores': false }, updatedAt: '2026-09-28T00:00:00.000Z' },
        });

        await settingsSync.start('user-1');

        expect(useScoresPreferences().preferences.value.hideScores).toBe(false);
    });

    it('falls back to local values for the session when the migration fails', async () => {
        localStorage.setItem(SCORES_KEY, JSON.stringify({ hideScores: true }));
        serverHas({}, null);
        vi.mocked(settingsApi.initialize).mockRejectedValue(new Error('down'));

        await settingsSync.start('user-1');

        expect(useSettingsSync().status.value).toBe('error');
        expect(useScoresPreferences().preferences.value.hideScores).toBe(true);
    });
});

describe('load failures and sign-out', () => {
    it('falls back to localStorage when the settings cannot be loaded', async () => {
        localStorage.setItem(SCORES_KEY, JSON.stringify({ hideScores: true }));
        vi.mocked(settingsApi.get).mockRejectedValue(new Error('Network Error'));

        await settingsSync.start('user-1');
        const { preferences } = useScoresPreferences();

        expect(useSettingsSync().status.value).toBe('error');
        expect(preferences.value.hideScores).toBe(true);

        preferences.value.useShortNames = false;
        await flushPromises();
        expect(settingsApi.update).not.toHaveBeenCalled();
        expect(storedJson(SCORES_KEY).useShortNames).toBe(false);
    });

    it('retries a failed load', async () => {
        vi.mocked(settingsApi.get).mockRejectedValueOnce(new Error('Network Error'));
        await settingsSync.start('user-1');

        serverHas({ 'scores.hideScores': true });
        await settingsSync.retry();

        expect(useSettingsSync().status.value).toBe('ready');
        expect(useScoresPreferences().preferences.value.hideScores).toBe(true);
    });

    it('shows an error with a working retry when the account cannot be identified', async () => {
        const reconnect = vi.fn(async () => {
            serverHas({ 'scores.hideScores': true });
            await settingsSync.start('user-1');
        });

        settingsSync.unavailable(reconnect);
        expect(useSettingsSync().status.value).toBe('error');

        await settingsSync.retry();

        expect(reconnect).toHaveBeenCalledTimes(1);
        expect(useSettingsSync().status.value).toBe('ready');
    });

    it('goes back to the local values on sign-out', async () => {
        localStorage.setItem(SCORES_KEY, JSON.stringify({ hideScores: false }));
        serverHas({ 'scores.hideScores': true });
        await settingsSync.start('user-1');
        const { preferences } = useScoresPreferences();
        expect(preferences.value.hideScores).toBe(true);

        settingsSync.stop();

        expect(preferences.value.hideScores).toBe(false);
        expect(useSettingsSync().status.value).toBe('signed-out');
    });

    it('ignores a load that finishes after sign-out', async () => {
        const pending = deferred<GetResult>();
        vi.mocked(settingsApi.get).mockReturnValue(pending.promise);

        const loading = settingsSync.start('user-1');
        settingsSync.stop();
        pending.resolve({ success: true, data: { settings: { 'scores.hideScores': true }, updatedAt: 'x' } });
        await loading;

        expect(useSettingsSync().status.value).toBe('signed-out');
        expect(useScoresPreferences().preferences.value.hideScores).toBe(false);
    });
});
