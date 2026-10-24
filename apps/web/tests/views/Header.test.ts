import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, type EffectScope } from 'vue';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
    profileApi: { getStats: vi.fn(), uploadAvatar: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
const auth = vi.hoisted(() => ({ signedIn: false }));
const build = vi.hoisted(() => ({ preview: false }));
vi.mock('@/utils/preview', () => ({
    get IS_PREVIEW() {
        return build.preview;
    },
}));
vi.mock('@logto/vue', () => ({
    useLogto: () => ({ isAuthenticated: auth.signedIn, signOut: vi.fn() }),
}));
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    return {
        useCurrentUser: () => ({
            currentUser: ref({ id: 'u1', username: 'hooper', memberSince: new Date(2024, 2, 5) }),
        }),
    };
});

// jsdom has no ResizeObserver (reka-ui's Slider on Settings) or PointerEvent.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

import Header from '@/views/Header.vue';
import Settings from '@/views/Settings.vue';
import { settingsApi, profileApi } from '@/network/api';
import { settingsSync } from '@/composables/useSettingsSync';
import { applyDisplayPreferences, useDisplayPreferences } from '@/composables/useDisplayPreferences';

const STORAGE_KEY = 'nba-display-preferences';
const storedTheme = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')?.theme;
const root = document.documentElement;

const router = createRouter({
    history: createMemoryHistory(),
    // The daily games get their own records: the Daily trigger matches on them.
    routes: ['/daily', '/cap-five', '/:pathMatch(.*)*'].map((path) => ({ path, component: { template: '<div />' } })),
});

let scope: EffectScope | null = null;
const wrappers: VueWrapper[] = [];

const mountHeader = async () => {
    const wrapper = mount(Header, { attachTo: document.body, global: { plugins: [router] } });
    wrappers.push(wrapper);
    await flushPromises();
    return wrapper;
};

const mountSettings = async () => {
    const wrapper = mount(Settings, {
        attachTo: document.body,
        global: { plugins: [router], stubs: { PageShell: { template: '<div><slot /></div>' } } },
    });
    wrappers.push(wrapper);
    await flushPromises();
    return wrapper;
};

// The menu and the sheet portal to document.body, so these look there.
const body = () => within(document.body);
const within = (el: HTMLElement) => ({
    byText: (selector: string, text: string) =>
        [...el.querySelectorAll<HTMLElement>(selector)].find((node) => node.textContent?.trim() === text),
});

const openMenu = async (trigger: Element | null | undefined) => {
    // reka-ui's menu trigger opens on Enter/Space; jsdom has no PointerEvent.
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushPromises();
};

const menuChoice = (label: string) => body().byText('[role="menuitemradio"]', label);

const settingsChoice = (settings: VueWrapper, label: string) =>
    [...settings.element.querySelectorAll<HTMLElement>('[aria-label="Theme"] button')].find(
        (button) => button.textContent?.trim() === label,
    );

beforeEach(() => {
    auth.signedIn = false;
    build.preview = false;
    settingsSync.stop();
    localStorage.clear();
    root.classList.remove('dark');
    vi.clearAllMocks();
    vi.mocked(settingsApi.update).mockImplementation(async (settings) => ({
        success: true as const,
        data: { settings, updatedAt: '2026-09-30T00:00:00.000Z' },
    }));
    vi.mocked(profileApi.getStats).mockResolvedValue({
        success: true,
        data: { teams: 0, publishedTeams: 0, customCoaches: 0, customGMs: 0, customPlayers: 0 },
    });
    vi.mocked(settingsApi.get).mockResolvedValue({
        success: true,
        data: { settings: { 'display.theme': 'light' }, updatedAt: '2026-09-01T00:00:00.000Z' },
    });
    scope = effectScope();
    scope.run(() => applyDisplayPreferences());
});

afterEach(() => {
    scope?.stop();
    // Unmount first: clearing body under a mounted tree breaks Vue's cleanup.
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = '';
});

describe('Header theme control, signed out', () => {
    it('picks a theme from the desktop menu, keeps it on this device and paints it', async () => {
        const header = await mountHeader();
        await openMenu(header.find('[data-testid="theme-trigger"]').element);

        menuChoice('Dark')!.click();
        await flushPromises();

        expect(storedTheme()).toBe('dark');
        expect(root.classList.contains('dark')).toBe(true);
        expect(settingsApi.update).not.toHaveBeenCalled();
    });

    it('picks a theme from the mobile menu, the same setting', async () => {
        const header = await mountHeader();
        header.find<HTMLElement>('[data-testid="mobile-menu-trigger"]').element.click();
        await flushPromises();

        body().byText('[data-testid="mobile-theme"] button', 'Dark')!.click();
        await flushPromises();

        expect(storedTheme()).toBe('dark');
    });

    it('shows the System icon when the stored theme is not one we know', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: 'auto' }));
        const header = await mountHeader();

        expect(header.find('[data-testid="theme-trigger"] svg').exists()).toBe(true);
    });

    it('keeps the current theme when the selected item is clicked again', async () => {
        useDisplayPreferences().preferences.value.theme = 'dark';
        const header = await mountHeader();
        header.find<HTMLElement>('[data-testid="mobile-menu-trigger"]').element.click();
        await flushPromises();

        body().byText('[data-testid="mobile-theme"] button', 'Dark')!.click();
        await flushPromises();

        expect(storedTheme()).toBe('dark');
    });
});

describe('Header theme control and Settings, signed in', () => {
    beforeEach(async () => {
        auth.signedIn = true;
        await settingsSync.start('u1');
    });

    // The header and Settings are two controls over one setting. If either
    // grew its own copy, these would fail.
    it('shows the synced value, and a change in either place reaches the other', async () => {
        const header = await mountHeader();
        const settings = await mountSettings();
        await openMenu(header.find('[data-testid="user-menu-trigger"]').element);

        expect(menuChoice('Light')!.getAttribute('aria-checked')).toBe('true');
        expect(settingsChoice(settings, 'Light')!.getAttribute('data-state')).toBe('on');

        menuChoice('Dark')!.click();
        await flushPromises();
        expect(settingsApi.update).toHaveBeenCalledWith({ 'display.theme': 'dark' });
        expect(settingsChoice(settings, 'Dark')!.getAttribute('data-state')).toBe('on');
        expect(root.classList.contains('dark')).toBe(true);

        settingsChoice(settings, 'System')!.click();
        await flushPromises();
        expect(settingsApi.update).toHaveBeenLastCalledWith({ 'display.theme': 'system' });
        await openMenu(header.find('[data-testid="user-menu-trigger"]').element);
        expect(menuChoice('System')!.getAttribute('aria-checked')).toBe('true');
    });

    it('keeps the chosen theme on this device after signing out, like Settings does', async () => {
        const header = await mountHeader();
        await openMenu(header.find('[data-testid="user-menu-trigger"]').element);
        menuChoice('Dark')!.click();
        await flushPromises();

        settingsSync.stop();
        auth.signedIn = false;
        await flushPromises();

        expect(storedTheme()).toBe('dark');
        expect(useDisplayPreferences().preferences.value.theme).toBe('dark');
        expect(root.classList.contains('dark')).toBe(true);
    });
});

describe('Header theme control while settings load', () => {
    it('ignores a pick instead of writing to a copy the server load will overwrite', async () => {
        auth.signedIn = true;
        vi.mocked(settingsApi.get).mockReturnValue(new Promise(() => {}));
        void settingsSync.start('u1');
        const header = await mountHeader();
        await openMenu(header.find('[data-testid="user-menu-trigger"]').element);

        menuChoice('Dark')!.click();
        await flushPromises();

        expect(storedTheme()).not.toBe('dark');
        expect(settingsApi.update).not.toHaveBeenCalled();
    });
});

describe('Header in a PR preview build', () => {
    it('shows neither Login nor the account menu, on desktop or mobile', async () => {
        build.preview = true;
        const header = await mountHeader();

        expect(header.find('.desktop-nav .login').exists()).toBe(false);
        expect(header.find('[data-testid="user-menu-trigger"]').exists()).toBe(false);
        expect(header.find('[data-testid="theme-trigger"]').exists()).toBe(true);

        header.find<HTMLElement>('[data-testid="mobile-menu-trigger"]').element.click();
        await flushPromises();
        expect(document.body.querySelector('.mobile-nav .login')).toBeNull();
        expect(body().byText('.mobile-nav span', 'Signed in as')).toBeUndefined();
    });
});

describe('Header Daily menu', () => {
    it('links each daily game from the desktop menu', async () => {
        const header = await mountHeader();
        await openMenu(header.find('[data-testid="daily-trigger"]').element);

        const links = [...document.body.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')];
        expect(links.map((link) => [link.querySelector('span')?.textContent, link.getAttribute('href')])).toEqual([
            ['Which Era?', '/daily'],
            ['Cap Five', '/cap-five'],
        ]);
    });

    it('lists both games in the mobile menu', async () => {
        const header = await mountHeader();
        header.find<HTMLElement>('[data-testid="mobile-menu-trigger"]').element.click();
        await flushPromises();

        expect(body().byText('.mobile-nav a', 'Which Era?')?.getAttribute('href')).toBe('/daily');
        expect(body().byText('.mobile-nav a', 'Cap Five')?.getAttribute('href')).toBe('/cap-five');
    });

    it('underlines the trigger only while a daily game is open', async () => {
        await router.push('/cap-five');
        const header = await mountHeader();
        expect(header.find('[data-testid="daily-trigger"]').classes()).toContain('active');

        await router.push('/scores');
        expect(header.find('[data-testid="daily-trigger"]').classes()).not.toContain('active');

        await router.push('/Daily/');
        expect(header.find('[data-testid="daily-trigger"]').classes()).toContain('active');
    });
});

describe('Header mobile menu', () => {
    const openMobileMenu = async (header: VueWrapper) => {
        header.find<HTMLElement>('[data-testid="mobile-menu-trigger"]').element.click();
        await flushPromises();
    };
    const tap = async (label: string) => {
        body().byText('.mobile-nav a', label)!.click();
        await flushPromises();
    };
    const menuIsOpen = () => document.body.querySelector('.mobile-nav') !== null;

    it.each([
        ['Home', '/'],
        ['Scores', '/scores'],
        ['Which Era?', '/daily'],
        ['Cap Five', '/cap-five'],
        ['Login', '/login'],
    ])('closes after tapping %s and goes to %s', async (label, path) => {
        await router.push('/teams');
        const header = await mountHeader();
        await openMobileMenu(header);
        expect(menuIsOpen()).toBe(true);

        await tap(label);

        expect(router.currentRoute.value.path).toBe(path);
        expect(menuIsOpen()).toBe(false);
    });

    it('closes when the tapped link is the page already open', async () => {
        await router.push('/scores');
        const header = await mountHeader();
        await openMobileMenu(header);

        await tap('Scores');

        expect(router.currentRoute.value.path).toBe('/scores');
        expect(menuIsOpen()).toBe(false);
    });

    it('closes after tapping Settings when signed in', async () => {
        auth.signedIn = true;
        await router.push('/teams');
        const header = await mountHeader();
        await openMobileMenu(header);

        await tap('Settings');

        expect(router.currentRoute.value.path).toBe('/settings');
        expect(menuIsOpen()).toBe(false);
    });

    it('stays open while picking a theme', async () => {
        await router.push('/teams');
        const header = await mountHeader();
        await openMobileMenu(header);

        body().byText('[data-testid="mobile-theme"] button', 'Dark')!.click();
        await flushPromises();

        expect(menuIsOpen()).toBe(true);
    });

    it.each([
        ['signed out', false],
        ['signed in', true],
    ])('renders its links as plain anchors when %s', async (_, signedIn) => {
        auth.signedIn = signedIn;
        await router.push('/teams');
        const header = await mountHeader();
        await openMobileMenu(header);

        // Five nav routes, two daily games, then Login or Settings.
        const links = [...document.body.querySelectorAll('.mobile-nav a')];
        expect(links).toHaveLength(8);
        expect(links.map((link) => link.getAttribute('type'))).toEqual(Array(8).fill(null));
    });
});
