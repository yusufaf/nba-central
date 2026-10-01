import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, nextTick, type EffectScope } from 'vue';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));

import { settingsApi } from '@/network/api';
import { settingsSync } from '@/composables/useSettingsSync';
import {
    applyDisplayPreferences,
    useDisplayPreferences,
    useReducedMotion,
} from '@/composables/useDisplayPreferences';
import { useDateFormat } from '@/composables/useDateFormat';

const STORAGE_KEY = 'nba-display-preferences';

const storedJson = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

// jsdom has no matchMedia. This stands in for the OS reduced-motion setting,
// and can flip it while the page is open like a real OS toggle would.
let osReducesMotion = false;
const mediaQueries: (EventTarget & { matches: boolean; media: string })[] = [];
const setOsReducesMotion = (value: boolean) => {
    osReducesMotion = value;
    for (const query of mediaQueries) {
        query.matches = value;
        query.dispatchEvent(Object.assign(new Event('change'), { matches: value }));
    }
};

const root = document.documentElement;
let scope: EffectScope | null = null;
const applyToDocument = () => {
    scope = effectScope();
    scope.run(() => applyDisplayPreferences());
};

beforeEach(() => {
    settingsSync.stop();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(settingsApi.update).mockImplementation(async (settings) => ({
        success: true as const,
        data: { settings, updatedAt: '2026-09-30T00:00:00.000Z' },
    }));
    osReducesMotion = false;
    mediaQueries.length = 0;
    window.matchMedia = vi.fn((media: string) => {
        const query = Object.assign(new EventTarget(), {
            media,
            matches: media.includes('reduce') && osReducesMotion,
        });
        mediaQueries.push(query);
        return query as unknown as MediaQueryList;
    });
});

afterEach(() => {
    scope?.stop();
    scope = null;
    root.classList.remove('reduce-motion');
    root.style.fontSize = '';
});

describe('useDisplayPreferences', () => {
    it('defaults to how the app looked before the settings existed', () => {
        const { preferences } = useDisplayPreferences();

        expect(preferences.value).toEqual({
            dateFormat: 'auto',
            timeFormat: 'auto',
            reducedMotion: 'system',
            fontScale: '100',
        });
    });

    it('signed out, reads and writes localStorage and never calls the API', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ timeFormat: '24h' }));

        const { preferences } = useDisplayPreferences();
        expect(preferences.value.timeFormat).toBe('24h');
        expect(preferences.value.dateFormat).toBe('auto');

        preferences.value.dateFormat = 'DD/MM/YYYY';
        await flushPromises();

        expect(storedJson().dateFormat).toBe('DD/MM/YYYY');
        expect(settingsApi.get).not.toHaveBeenCalled();
        expect(settingsApi.update).not.toHaveBeenCalled();
    });

    it('signed in, shows the server values and saves each change as its own key', async () => {
        vi.mocked(settingsApi.get).mockResolvedValue({
            success: true,
            data: {
                settings: { 'display.dateFormat': 'YYYY-MM-DD', 'display.fontScale': '125' },
                updatedAt: '2026-09-01T00:00:00.000Z',
            },
        });
        await settingsSync.start('user-1');

        const { preferences } = useDisplayPreferences();
        expect(preferences.value.dateFormat).toBe('YYYY-MM-DD');
        expect(preferences.value.fontScale).toBe('125');
        expect(preferences.value.reducedMotion).toBe('system');

        preferences.value.reducedMotion = 'reduce';
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledWith({ 'display.reducedMotion': 'reduce' });
        expect(storedJson()?.reducedMotion ?? 'system').toBe('system');
    });
});

describe('useDateFormat', () => {
    const evening = new Date(2026, 9, 1, 19, 30);

    it('formats with the current preferences, and follows a change elsewhere', async () => {
        const { formatDate, formatTime } = useDateFormat();
        expect(formatDate(evening, 'long')).toBe('Thursday, October 1, 2026');

        const { preferences } = useDisplayPreferences();
        preferences.value.dateFormat = 'DD/MM/YYYY';
        preferences.value.timeFormat = '24h';
        await nextTick();

        expect(formatDate(evening, 'long')).toBe('Thursday, 01/10/2026');
        expect(formatTime(evening)).toBe('19:30');
    });
});

describe('reduced motion', () => {
    it('follows the OS by default, including a change while the page is open', async () => {
        const reduceMotion = useReducedMotion();
        applyToDocument();
        await nextTick();
        expect(reduceMotion.value).toBe(false);
        expect(root.classList.contains('reduce-motion')).toBe(false);

        setOsReducesMotion(true);
        await nextTick();
        expect(reduceMotion.value).toBe(true);
        expect(root.classList.contains('reduce-motion')).toBe(true);
    });

    it('"reduce" turns motion off even when the OS allows it', async () => {
        applyToDocument();
        useDisplayPreferences().preferences.value.reducedMotion = 'reduce';
        await nextTick();

        expect(root.classList.contains('reduce-motion')).toBe(true);
    });

    it('"allow" keeps motion on even when the OS asks to reduce it', async () => {
        setOsReducesMotion(true);
        const reduceMotion = useReducedMotion();
        applyToDocument();
        await nextTick();
        expect(root.classList.contains('reduce-motion')).toBe(true);

        useDisplayPreferences().preferences.value.reducedMotion = 'allow';
        await nextTick();

        expect(reduceMotion.value).toBe(false);
        expect(root.classList.contains('reduce-motion')).toBe(false);
    });
});

describe('font scale', () => {
    it('leaves the root font size alone at the default', async () => {
        applyToDocument();
        await nextTick();

        expect(root.style.fontSize).toBe('');
    });

    it('scales the root font size, which every rem in the app follows', async () => {
        applyToDocument();
        useDisplayPreferences().preferences.value.fontScale = '137.5';
        await nextTick();

        expect(root.style.fontSize).toBe('137.5%');
    });
});
