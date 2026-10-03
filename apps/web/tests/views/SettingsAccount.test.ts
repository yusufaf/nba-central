import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
    profileApi: { getStats: vi.fn(), uploadAvatar: vi.fn() },
    accountDataApi: { exportData: vi.fn(), deleteData: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
const logto = vi.hoisted(() => ({
    signOut: vi.fn(),
    clearAllTokens: vi.fn(),
    error: { value: undefined as unknown },
}));
vi.mock('@logto/vue', () => ({ useLogto: () => logto }));
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    return {
        useCurrentUser: () => ({
            currentUser: ref({ id: 'u1', username: 'hooper', memberSince: null }),
        }),
    };
});

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

import Settings from '@/views/Settings.vue';
import { accountDataApi, profileApi, settingsApi } from '@/network/api';
import { settingsSync } from '@/composables/useSettingsSync';
import { PREFERENCE_SECTIONS } from '@/constants/preferences';
import { consumeDataDeletedFlag } from '@/composables/useAccountData';
import type { UserDataExport } from '@/models/api';

const mountAccountTab = async () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/settings', component: Settings }],
    });
    await router.push('/settings?tab=account');
    const wrapper = mount(Settings, {
        attachTo: document.body,
        global: {
            plugins: [router],
            stubs: { PageShell: { template: '<div><slot /></div>' } },
        },
    });
    await flushPromises();
    return wrapper;
};

enableAutoUnmount(afterEach);

const EXPORT: UserDataExport = {
    version: 1,
    exportedAt: '2026-10-02T12:00:00.000Z',
    user: { id: 'u1', username: 'hooper' },
    settings: { 'display.fontScale': '112.5' },
    settingsUpdatedAt: '2026-09-01T00:00:00.000Z',
    avatarUrl: null,
    teams: [{ teamUUID: 't1', title: 'Bulls', roster: [{ slot: 0 }] }],
    customCoaches: [],
    customGMs: [],
    customPlayers: [],
    other: [],
};

const button = (wrapper: Awaited<ReturnType<typeof mountAccountTab>>, name: string) =>
    wrapper.findAll('button').find((b) => b.text().includes(name))!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const dialogButton = (name: string) =>
    [...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes(name),
    )!;
const typeConfirmation = async (text: string) => {
    const input = dialog()!.querySelector<HTMLInputElement>('#delete-data-confirmation')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await flushPromises();
};
const openDeleteDialog = async (wrapper: Awaited<ReturnType<typeof mountAccountTab>>) => {
    await button(wrapper, 'Delete my data').trigger('click');
    await flushPromises();
    return dialog()!;
};

let downloads: { blob: Blob; filename: string }[];

beforeEach(async () => {
    settingsSync.stop();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    logto.error.value = undefined;
    downloads = [];
    vi.mocked(profileApi.getStats).mockResolvedValue({
        success: true,
        data: { teams: 0, publishedTeams: 0, customCoaches: 0, customGMs: 0, customPlayers: 0 },
    });
    vi.mocked(settingsApi.get).mockResolvedValue({
        success: true,
        data: { settings: {}, updatedAt: '2026-09-01T00:00:00.000Z', avatarUrl: null },
    });
    await settingsSync.start('u1');

    // Only the two statics: the avatar code still needs URL as a constructor.
    let lastBlob: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => {
        lastBlob = blob;
        return 'blob:mock';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
    ) {
        downloads.push({ blob: lastBlob!, filename: this.download });
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('Settings account: export', () => {
    it('downloads the export as one JSON file', async () => {
        vi.mocked(accountDataApi.exportData).mockResolvedValue({ success: true, data: EXPORT });
        const wrapper = await mountAccountTab();

        await button(wrapper, 'Download my data').trigger('click');
        await flushPromises();

        expect(accountDataApi.exportData).toHaveBeenCalledTimes(1);
        expect(downloads).toHaveLength(1);
        const [{ blob, filename }] = downloads;
        expect(filename).toBe('nba-central-data-2026-10-02.json');
        expect(blob.type).toBe('application/json');
        expect(JSON.parse(await blob.text())).toEqual(EXPORT);
    });

    it("shows the server's reason when the export fails, and downloads nothing", async () => {
        vi.mocked(accountDataApi.exportData).mockRejectedValue({
            response: {
                status: 413,
                data: { success: false, error: 'Your data is too large to export in one file' },
            },
        });
        const wrapper = await mountAccountTab();

        await button(wrapper, 'Download my data').trigger('click');
        await flushPromises();

        expect(wrapper.find('[data-testid="export-error"]').text()).toContain(
            'Your data is too large to export in one file',
        );
        expect(downloads).toEqual([]);
    });
});

describe('Settings account: delete', () => {
    it('keeps the delete button disabled until the phrase is typed', async () => {
        const wrapper = await mountAccountTab();
        await openDeleteDialog(wrapper);

        expect(dialogButton('Delete permanently').disabled).toBe(true);

        await typeConfirmation('delete my');
        expect(dialogButton('Delete permanently').disabled).toBe(true);

        await typeConfirmation('hooper');
        expect(dialogButton('Delete permanently').disabled).toBe(true);

        await typeConfirmation('  Delete My Data ');
        expect(dialogButton('Delete permanently').disabled).toBe(false);
        expect(accountDataApi.deleteData).not.toHaveBeenCalled();
    });

    it("deletes, clears this device's preferences, then signs out to the confirmation page", async () => {
        const order: string[] = [];
        vi.mocked(accountDataApi.deleteData).mockImplementation(async () => {
            order.push('delete');
            return { success: true, data: { deletedItems: 3, deletedFiles: 1 } };
        });
        logto.signOut.mockImplementation(async () => {
            order.push('signOut');
        });
        for (const { storageKey } of Object.values(PREFERENCE_SECTIONS)) {
            localStorage.setItem(storageKey, '{}');
        }
        localStorage.setItem('nba-followed-games', '{}');
        const wrapper = await mountAccountTab();
        await openDeleteDialog(wrapper);

        await typeConfirmation('delete my data');
        dialogButton('Delete permanently').click();
        await flushPromises();

        expect(accountDataApi.deleteData).toHaveBeenCalledWith();
        expect(order).toEqual(['delete', 'signOut']);
        expect(logto.signOut).toHaveBeenCalledWith(window.location.origin);
        for (const { storageKey } of Object.values(PREFERENCE_SECTIONS)) {
            expect(localStorage.getItem(storageKey)).toBeNull();
        }
        // Followed games are this device's, never the account's.
        expect(localStorage.getItem('nba-followed-games')).toBe('{}');
        expect(consumeDataDeletedFlag()).toBe(true);
        expect(consumeDataDeletedFlag()).toBe(false);
    });

    it('clears the tokens itself when Logto sign-out fails, so the user still ends signed out', async () => {
        vi.mocked(accountDataApi.deleteData).mockResolvedValue({
            success: true,
            data: { deletedItems: 0, deletedFiles: 0 },
        });
        logto.signOut.mockImplementation(async () => {
            logto.error.value = new Error('fetch failed');
        });
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, origin: window.location.origin, assign });
        const wrapper = await mountAccountTab();
        await openDeleteDialog(wrapper);

        await typeConfirmation('delete my data');
        dialogButton('Delete permanently').click();
        await flushPromises();

        expect(logto.clearAllTokens).toHaveBeenCalled();
        expect(assign).toHaveBeenCalledWith(window.location.origin);
    });

    it('shows a clear message and stays signed in when the delete fails', async () => {
        vi.mocked(accountDataApi.deleteData).mockRejectedValue({
            response: { status: 500, data: { success: false, error: 'Failed to delete your data' } },
        });
        const key = PREFERENCE_SECTIONS.display.storageKey;
        localStorage.setItem(key, JSON.stringify({ fontScale: '125' }));
        const wrapper = await mountAccountTab();
        await openDeleteDialog(wrapper);

        await typeConfirmation('delete my data');
        dialogButton('Delete permanently').click();
        await flushPromises();

        const error = dialog()!.querySelector('[data-testid="delete-error"]');
        expect(error?.getAttribute('role')).toBe('alert');
        expect(error?.textContent).toContain("Couldn't delete your data");
        expect(error?.textContent).toContain('safe to try again');
        expect(logto.signOut).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem(key)!).fontScale).toBe('125');
        expect(consumeDataDeletedFlag()).toBe(false);
        // The dialog stays open, ready for a retry.
        expect(dialogButton('Delete permanently').disabled).toBe(false);
    });

    it('cannot be sent twice while a delete is in flight', async () => {
        let resolveDelete!: (value: unknown) => void;
        vi.mocked(accountDataApi.deleteData).mockReturnValue(
            new Promise((resolve) => {
                resolveDelete = resolve;
            }) as never,
        );
        const wrapper = await mountAccountTab();
        await openDeleteDialog(wrapper);
        await typeConfirmation('delete my data');

        dialogButton('Delete permanently').click();
        await flushPromises();
        dialogButton('Please wait').click();
        await flushPromises();

        expect(accountDataApi.deleteData).toHaveBeenCalledTimes(1);
        resolveDelete({ success: true, data: { deletedItems: 0, deletedFiles: 0 } });
        await flushPromises();
    });
});

describe('Settings account: sign-in links', () => {
    it("links to Logto's Account Center for email and password, with a way back", async () => {
        vi.stubEnv('VITE_LOGTO_ENDPOINT', 'https://auth.example');
        const wrapper = await mountAccountTab();

        const back = encodeURIComponent(`${window.location.origin}/settings?tab=account`);
        const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'));
        expect(hrefs).toContain(`https://auth.example/account/email?redirect=${back}`);
        expect(hrefs).toContain(`https://auth.example/account/password?redirect=${back}`);
    });

    it('leaves the links out when no Logto endpoint is configured', async () => {
        vi.stubEnv('VITE_LOGTO_ENDPOINT', '');
        const wrapper = await mountAccountTab();

        expect(wrapper.findAll('a').some((a) => a.attributes('href')?.includes('/account/'))).toBe(
            false,
        );
    });
});
