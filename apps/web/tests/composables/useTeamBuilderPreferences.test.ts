import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));

import { settingsApi } from '@/network/api';
import { settingsSync } from '@/composables/useSettingsSync';
import { useTeamBuilderPreferences } from '@/composables/useTeamBuilderPreferences';

const STORAGE_KEY = 'nba-team-builder-preferences';

const storedJson = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

const serverHas = (settings: Record<string, unknown>) =>
    vi.mocked(settingsApi.get).mockResolvedValue({
        success: true,
        data: { settings, updatedAt: '2026-09-01T00:00:00.000Z' },
    });

beforeEach(() => {
    settingsSync.stop();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(settingsApi.update).mockImplementation(async (settings) => ({
        success: true as const,
        data: { settings, updatedAt: '2026-09-30T00:00:00.000Z' },
    }));
});

describe('useTeamBuilderPreferences', () => {
    it('defaults to how the builder behaved before the setting existed', () => {
        const { preferences, undoToastDuration, shouldConfirm } = useTeamBuilderPreferences();

        expect(preferences.value).toEqual({
            confirmDestructive: true,
            undoToastSeconds: '8',
            flipNewCards: false,
            drawerSide: 'right',
        });
        expect(undoToastDuration.value).toBe(8000);
        expect(shouldConfirm({ undoable: true })).toBe(true);
        expect(shouldConfirm({ undoable: false })).toBe(true);
    });

    it('converts the chosen undo toast duration to milliseconds', () => {
        const { preferences, undoToastDuration } = useTeamBuilderPreferences();
        preferences.value.undoToastSeconds = '15';
        expect(undoToastDuration.value).toBe(15000);
    });

    it('skips the confirmation only for an action that can be undone', () => {
        const { preferences, shouldConfirm } = useTeamBuilderPreferences();
        preferences.value.confirmDestructive = false;

        expect(shouldConfirm({ undoable: true })).toBe(false);
        expect(shouldConfirm({ undoable: false })).toBe(true);
    });

    it('signed out, reads and writes localStorage and never calls the API', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ flipNewCards: true }));

        const { preferences } = useTeamBuilderPreferences();
        expect(preferences.value.flipNewCards).toBe(true);
        expect(preferences.value.undoToastSeconds).toBe('8');

        preferences.value.drawerSide = 'left';
        await flushPromises();

        expect(storedJson().drawerSide).toBe('left');
        expect(settingsApi.get).not.toHaveBeenCalled();
        expect(settingsApi.update).not.toHaveBeenCalled();
    });

    it('signed in, shows the server values and saves each change as its own key', async () => {
        serverHas({ 'teamBuilder.confirmDestructive': false, 'teamBuilder.undoToastSeconds': '30' });
        await settingsSync.start('user-1');

        const { preferences, undoToastDuration, shouldConfirm } = useTeamBuilderPreferences();
        expect(preferences.value.confirmDestructive).toBe(false);
        expect(undoToastDuration.value).toBe(30000);
        expect(shouldConfirm({ undoable: true })).toBe(false);
        expect(preferences.value.flipNewCards).toBe(false);

        preferences.value.flipNewCards = true;
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledWith({ 'teamBuilder.flipNewCards': true });
        expect(storedJson()?.flipNewCards ?? false).toBe(false);
    });

    it('uploads team builder preferences kept locally on first sign-in', async () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ confirmDestructive: false, undoToastSeconds: '15' }),
        );
        vi.mocked(settingsApi.get).mockResolvedValue({
            success: true,
            data: { settings: {}, updatedAt: null },
        });
        vi.mocked(settingsApi.initialize).mockImplementation(async (settings) => ({
            success: true as const,
            data: { settings, updatedAt: '2026-09-30T00:00:00.000Z' },
        }));

        await settingsSync.start('user-1');

        expect(settingsApi.initialize).toHaveBeenCalledWith({
            'teamBuilder.confirmDestructive': false,
            'teamBuilder.undoToastSeconds': '15',
        });
        expect(useTeamBuilderPreferences().undoToastDuration.value).toBe(15000);
    });
});
