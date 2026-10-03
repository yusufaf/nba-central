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
    useResolvedTheme,
} from '@/composables/useDisplayPreferences';
import { useDateFormat } from '@/composables/useDateFormat';

const STORAGE_KEY = 'nba-display-preferences';

const storedJson = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

// jsdom has no matchMedia. This stands in for the OS reduced-motion and dark
// mode settings, and can flip either while the page is open like a real OS
// toggle would.
let osReducesMotion = false;
let osPrefersDark = false;
const mediaQueries: (EventTarget & { matches: boolean; media: string })[] = [];
const osMatches = (media: string) =>
    (media.includes('reduce') && osReducesMotion) ||
    (media.includes('prefers-color-scheme: dark') && osPrefersDark);
const notifyMediaQueries = () => {
    for (const query of mediaQueries) {
        const matches = osMatches(query.media);
        if (query.matches === matches) continue;
        query.matches = matches;
        query.dispatchEvent(Object.assign(new Event('change'), { matches }));
    }
};
const setOsReducesMotion = (value: boolean) => {
    osReducesMotion = value;
    notifyMediaQueries();
};
const setOsPrefersDark = (value: boolean) => {
    osPrefersDark = value;
    notifyMediaQueries();
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
    osPrefersDark = false;
    mediaQueries.length = 0;
    window.matchMedia = vi.fn((media: string) => {
        const query = Object.assign(new EventTarget(), {
            media,
            matches: osMatches(media),
        });
        mediaQueries.push(query);
        return query as unknown as MediaQueryList;
    });
});

afterEach(() => {
    scope?.stop();
    scope = null;
    root.classList.remove('reduce-motion', 'dark');
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
            theme: 'system',
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

describe('theme', () => {
    it('follows the OS by default, including a change while the page is open', async () => {
        setOsPrefersDark(true);
        const theme = useResolvedTheme();
        applyToDocument();
        await nextTick();
        expect(theme.value).toBe('dark');
        expect(root.classList.contains('dark')).toBe(true);

        setOsPrefersDark(false);
        await nextTick();
        expect(theme.value).toBe('light');
        expect(root.classList.contains('dark')).toBe(false);

        setOsPrefersDark(true);
        await nextTick();
        expect(root.classList.contains('dark')).toBe(true);
    });

    it('"light" and "dark" override the OS, and ignore its changes', async () => {
        setOsPrefersDark(true);
        applyToDocument();
        const { preferences } = useDisplayPreferences();
        preferences.value.theme = 'light';
        await nextTick();
        expect(root.classList.contains('dark')).toBe(false);

        setOsPrefersDark(false);
        preferences.value.theme = 'dark';
        await nextTick();
        expect(root.classList.contains('dark')).toBe(true);

        setOsPrefersDark(true);
        setOsPrefersDark(false);
        await nextTick();
        expect(root.classList.contains('dark')).toBe(true);
    });

    it('signed out, applies the theme stored on this device and saves a change there', async () => {
        setOsPrefersDark(true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'light' }));
        applyToDocument();
        await nextTick();
        expect(root.classList.contains('dark')).toBe(false);

        useDisplayPreferences().preferences.value.theme = 'dark';
        await flushPromises();

        expect(storedJson().theme).toBe('dark');
        expect(settingsApi.update).not.toHaveBeenCalled();
    });

    // index.html paints the theme from this device's copy before the app (and
    // the settings sync) loads, so a signed-in choice has to land there too.
    it('signed in, applies the synced theme and keeps a copy on this device for the first paint', async () => {
        vi.mocked(settingsApi.get).mockResolvedValue({
            success: true,
            data: { settings: { 'display.theme': 'light' }, updatedAt: '2026-09-01T00:00:00.000Z' },
        });
        setOsPrefersDark(true);
        applyToDocument();
        await nextTick();
        expect(root.classList.contains('dark')).toBe(true);

        await settingsSync.start('user-1');
        await nextTick();
        expect(root.classList.contains('dark')).toBe(false);
        expect(storedJson().theme).toBe('light');

        useDisplayPreferences().preferences.value.theme = 'dark';
        await flushPromises();
        expect(settingsApi.update).toHaveBeenCalledWith({ 'display.theme': 'dark' });
        expect(root.classList.contains('dark')).toBe(true);
        expect(storedJson().theme).toBe('dark');
    });

    it('keeps the signed-in theme after signing out, instead of flipping back', async () => {
        vi.mocked(settingsApi.get).mockResolvedValue({
            success: true,
            data: { settings: { 'display.theme': 'light' }, updatedAt: '2026-09-01T00:00:00.000Z' },
        });
        setOsPrefersDark(true);
        applyToDocument();
        await settingsSync.start('user-1');
        await nextTick();

        settingsSync.stop();
        await nextTick();

        expect(useDisplayPreferences().preferences.value.theme).toBe('light');
        expect(root.classList.contains('dark')).toBe(false);
    });

    it('copies only the theme to this device, not the other synced display settings', async () => {
        vi.mocked(settingsApi.get).mockResolvedValue({
            success: true,
            data: {
                settings: { 'display.theme': 'dark', 'display.fontScale': '125' },
                updatedAt: '2026-09-01T00:00:00.000Z',
            },
        });
        applyToDocument();
        await settingsSync.start('user-1');
        await flushPromises();

        expect(storedJson().theme).toBe('dark');
        expect(storedJson().fontScale).toBe('100');
    });
});
