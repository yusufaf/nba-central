import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
    profileApi: { getStats: vi.fn(), uploadAvatar: vi.fn() },
}));
// jsdom can't decode or draw images; validation stays real.
vi.mock('@/utils/avatarImage', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils/avatarImage')>()),
    resizeAvatar: vi.fn(async () => new Blob(['resized'])),
    blobToBase64: vi.fn(async () => 'cmVzaXplZA=='),
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
const signOut = vi.fn();
vi.mock('@logto/vue', () => ({ useLogto: () => ({ signOut }) }));
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    return {
        useCurrentUser: () => ({
            currentUser: ref({
                id: 'u1',
                username: 'hooper',
                memberSince: new Date(2024, 2, 5),
            }),
        }),
    };
});

// jsdom has no ResizeObserver, which reka-ui's Slider (Text size) uses to
// measure its thumb.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

import Settings from '@/views/Settings.vue';
import { Slider } from '@/components/ui/slider';
import { useDisplayPreferences } from '@/composables/useDisplayPreferences';
import { profileApi, settingsApi } from '@/network/api';
import { settingsSync } from '@/composables/useSettingsSync';

const makeRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/settings', component: Settings }],
    });

const mountAt = async (url: string) => {
    const router = makeRouter();
    await router.push(url);
    const wrapper = mount(Settings, {
        attachTo: document.body,
        global: {
            plugins: [router],
            stubs: { PageShell: { template: '<div><slot /></div>' } },
        },
    });
    await flushPromises();
    return { wrapper, router };
};

enableAutoUnmount(afterEach);

const STATS = { teams: 4, publishedTeams: 1, customCoaches: 2, customGMs: 3, customPlayers: 0 };

beforeEach(async () => {
    settingsSync.stop();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(profileApi.getStats).mockResolvedValue({ success: true, data: STATS });
    vi.mocked(settingsApi.get).mockResolvedValue({
        success: true,
        data: { settings: { 'scores.hideScores': true }, updatedAt: '2026-09-01T00:00:00.000Z' },
    });
    await settingsSync.start('u1');
});

describe('Settings', () => {
    it('puts the default tab in the URL', async () => {
        const { router } = await mountAt('/settings');
        expect(router.currentRoute.value.query.tab).toBe('preferences');
    });

    it('replaces an unknown tab with the default', async () => {
        const { router } = await mountAt('/settings?tab=nope');
        expect(router.currentRoute.value.query.tab).toBe('preferences');
    });

    it('opens the tab named in the URL', async () => {
        const { wrapper } = await mountAt('/settings?tab=account');
        expect(wrapper.text()).toContain('hooper');
        expect(wrapper.text()).not.toContain('Season format');
    });

    it('shows the server values and saves a toggle as it changes', async () => {
        let resolveSave!: (value: unknown) => void;
        vi.mocked(settingsApi.update).mockReturnValue(
            new Promise((resolve) => {
                resolveSave = resolve;
            }) as never,
        );
        const { wrapper } = await mountAt('/settings?tab=preferences');

        const hideScores = wrapper.find<HTMLInputElement>('#setting-hide-scores');
        expect(hideScores.element.checked).toBe(true);

        await hideScores.setValue(false);
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledWith({ 'scores.hideScores': false });
        expect(wrapper.findAll('[data-testid="setting-saving"]')).toHaveLength(1);
        expect(hideScores.element.disabled).toBe(true);

        resolveSave({ success: true, data: { settings: {}, updatedAt: 'x' } });
        await flushPromises();

        expect(wrapper.findAll('[data-testid="setting-saving"]')).toHaveLength(0);
        expect(hideScores.element.disabled).toBe(false);
    });

    it('saves a choice from a toggle group and ignores a deselect', async () => {
        vi.mocked(settingsApi.update).mockResolvedValue({
            success: true,
            data: { settings: {}, updatedAt: 'x' },
        });
        const { wrapper } = await mountAt('/settings');

        const conference = wrapper.find('[aria-label="Conference filter"]');
        const west = conference.findAll('button').find((b) => b.text() === 'West')!;
        await west.trigger('click');
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledWith({ 'scores.conferenceFilter': 'WEST' });
        expect(west.attributes('data-state')).toBe('on');

        await west.trigger('click');
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledTimes(1);
        expect(west.attributes('data-state')).toBe('on');
    });

    it('saves each team builder preference under its own key', async () => {
        vi.mocked(settingsApi.update).mockResolvedValue({
            success: true,
            data: { settings: {}, updatedAt: 'x' },
        });
        const { wrapper } = await mountAt('/settings');

        const confirm = wrapper.find<HTMLInputElement>('#setting-confirm-destructive');
        expect(confirm.element.checked).toBe(true);
        await confirm.setValue(false);
        await flushPromises();
        expect(settingsApi.update).toHaveBeenLastCalledWith({
            'teamBuilder.confirmDestructive': false,
        });

        const duration = wrapper.find('[aria-label="Undo toast duration"]');
        const eight = duration.findAll('button').find((b) => b.text() === '8s')!;
        expect(eight.attributes('data-state')).toBe('on');
        await duration.findAll('button').find((b) => b.text() === '15s')!.trigger('click');
        await flushPromises();
        expect(settingsApi.update).toHaveBeenLastCalledWith({
            'teamBuilder.undoToastSeconds': '15',
        });

        await wrapper.find<HTMLInputElement>('#setting-flip-new-cards').setValue(true);
        await flushPromises();
        expect(settingsApi.update).toHaveBeenLastCalledWith({ 'teamBuilder.flipNewCards': true });

        const drawer = wrapper.find('[aria-label="Drawer side"]');
        await drawer.findAll('button').find((b) => b.text() === 'Left')!.trigger('click');
        await flushPromises();
        expect(settingsApi.update).toHaveBeenLastCalledWith({ 'teamBuilder.drawerSide': 'left' });
    });

    it('saves each display preference under its own key', async () => {
        vi.mocked(settingsApi.update).mockResolvedValue({
            success: true,
            data: { settings: {}, updatedAt: 'x' },
        });
        const { wrapper } = await mountAt('/settings');

        const choices: [string, string, string, string][] = [
            ['Date format', 'Automatic', 'DD/MM/YYYY', 'display.dateFormat'],
            ['Time format', 'Automatic', '24-hour', 'display.timeFormat'],
            ['Reduced motion', 'System', 'Reduce', 'display.reducedMotion'],
        ];
        const values: Record<string, string> = {
            'DD/MM/YYYY': 'DD/MM/YYYY',
            '24-hour': '24h',
            Reduce: 'reduce',
        };
        for (const [group, selected, next, key] of choices) {
            const buttons = wrapper.find(`[aria-label="${group}"]`).findAll('button');
            expect(buttons.find((b) => b.text() === selected)!.attributes('data-state')).toBe('on');
            await buttons.find((b) => b.text() === next)!.trigger('click');
            await flushPromises();
            expect(settingsApi.update).toHaveBeenLastCalledWith({ [key]: values[next] });
        }

        expect(wrapper.text()).toMatch(/Today: \w+day, \d{2}\/\d{2}\/\d{4}/);
    });

    // The page isn't rescaled mid-drag: that would move the slider out from
    // under the pointer. A sample line previews the step instead.
    it('previews a dragged text size on the sample, then saves and applies it on release', async () => {
        vi.mocked(settingsApi.update).mockResolvedValue({
            success: true,
            data: { settings: {}, updatedAt: 'x' },
        });
        const { wrapper } = await mountAt('/settings');
        const slider = wrapper.findComponent(Slider);
        const sample = () => wrapper.find('[data-testid="text-size-sample"]');
        expect(sample().attributes('style')).toBe('--sample-scale: 1;');

        slider.vm.$emit('update:modelValue', [112.5]);
        slider.vm.$emit('update:modelValue', [125]);
        await flushPromises();
        expect(settingsApi.update).not.toHaveBeenCalled();
        expect(sample().attributes('style')).toBe('--sample-scale: 1.25;');
        expect(wrapper.text()).toContain('125%');
        expect(useDisplayPreferences().preferences.value.fontScale).toBe('100');

        slider.vm.$emit('valueCommit', [125]);
        await flushPromises();
        expect(settingsApi.update).toHaveBeenCalledTimes(1);
        expect(settingsApi.update).toHaveBeenLastCalledWith({ 'display.fontScale': '125' });
        expect(useDisplayPreferences().preferences.value.fontScale).toBe('125');
        expect(sample().attributes('style')).toBe('--sample-scale: 1;');
    });

    // reka's Slider only commits a value that changed during the drag.
    it('a drag that ends on the saved size leaves no preview behind', async () => {
        const { wrapper } = await mountAt('/settings');
        const slider = wrapper.findComponent(Slider);

        slider.vm.$emit('update:modelValue', [125]);
        slider.vm.$emit('update:modelValue', [100]);
        await flushPromises();
        useDisplayPreferences().preferences.value.fontScale = '112.5';
        await flushPromises();

        expect(wrapper.text()).toContain('112.5%');
        expect(settingsApi.update).toHaveBeenCalledTimes(1);
    });

    it('saves the text size once per change, not once per step dragged over', async () => {
        vi.mocked(settingsApi.update).mockResolvedValue({
            success: true,
            data: { settings: {}, updatedAt: 'x' },
        });
        const { wrapper } = await mountAt('/settings');

        const thumb = wrapper.find('[aria-label="Text size"] [role="slider"]');
        expect(thumb.attributes('aria-valuenow')).toBe('100');
        await thumb.trigger('keydown', { key: 'ArrowRight' });
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledTimes(1);
        expect(settingsApi.update).toHaveBeenLastCalledWith({ 'display.fontScale': '112.5' });
        expect(wrapper.text()).toContain('112.5%');
    });

    it('offers a retry when the settings could not be loaded', async () => {
        settingsSync.stop();
        vi.mocked(settingsApi.get).mockClear();
        vi.mocked(settingsApi.get).mockRejectedValueOnce(new Error('down'));
        await settingsSync.start('u1');

        const { wrapper } = await mountAt('/settings');
        expect(wrapper.text()).toContain("Couldn't load your settings.");

        const retry = wrapper.findAll('button').find((b) => b.text().includes('Try again'));
        await retry!.trigger('click');
        await flushPromises();

        expect(settingsApi.get).toHaveBeenCalledTimes(2);
        expect(wrapper.find('#setting-hide-scores').exists()).toBe(true);
    });
});

describe('Settings profile card', () => {
    const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
    const openPicker = async (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) => {
        await wrapper.find('[data-testid="change-avatar"]').trigger('click');
        await flushPromises();
        return dialog()!;
    };
    const chooseFile = async (file: File) => {
        const input = document.querySelector<HTMLInputElement>('[data-testid="avatar-file-input"]')!;
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
        await flushPromises();
    };
    const fileOf = (type: string, bytes: number) => {
        const file = new File(['x'], 'me', { type });
        Object.defineProperty(file, 'size', { value: bytes });
        return file;
    };
    const uploadError = () =>
        dialog()!.querySelector('[data-testid="avatar-upload-error"]')?.textContent?.trim();
    const saved = () =>
        vi.mocked(settingsApi.update).mockResolvedValue({
            success: true,
            data: { settings: {}, updatedAt: 'x' },
        });

    it('shows the username, member-since date and the counts from the server', async () => {
        const { wrapper } = await mountAt('/settings');
        const card = wrapper.find('[data-testid="profile-card"]');
        const medium = new Date(2024, 2, 5).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        expect(card.text()).toContain('hooper');
        expect(card.text()).toContain(`Member since ${medium}`);
        expect(profileApi.getStats).toHaveBeenCalledTimes(1);
        const count = (key: string) => card.find(`[data-testid="stat-${key}"] dd`).text();
        expect(count('teams')).toBe('4');
        expect(count('publishedTeams')).toBe('1');
        expect(count('customCoaches')).toBe('2');
        expect(count('customGMs')).toBe('3');
        expect(count('customPlayers')).toBe('0');
    });

    it('formats member-since with the date format setting', async () => {
        vi.mocked(settingsApi.get).mockResolvedValue({
            success: true,
            data: {
                settings: { 'display.dateFormat': 'DD/MM/YYYY' },
                updatedAt: 'x',
                avatarUrl: null,
            },
        });
        settingsSync.stop();
        await settingsSync.start('u1');

        const { wrapper } = await mountAt('/settings');

        expect(wrapper.find('[data-testid="profile-card"]').text()).toContain(
            'Member since 05/03/2024',
        );
    });

    it('offers to reload the counts when they fail', async () => {
        vi.mocked(profileApi.getStats).mockRejectedValueOnce(new Error('down'));
        const { wrapper } = await mountAt('/settings');
        expect(wrapper.text()).toContain("Couldn't load your counts.");

        await wrapper
            .findAll('button')
            .find((b) => b.text().includes('Reload counts'))!
            .trigger('click');
        await flushPromises();

        expect(profileApi.getStats).toHaveBeenCalledTimes(2);
        expect(wrapper.find('[data-testid="stat-teams"] dd').text()).toBe('4');
    });

    it("can't change the avatar until the settings have loaded", async () => {
        settingsSync.stop();
        vi.mocked(settingsApi.get).mockRejectedValueOnce(new Error('down'));
        await settingsSync.start('u1');

        const { wrapper } = await mountAt('/settings');

        expect(wrapper.find('[data-testid="change-avatar"]').attributes('disabled')).toBeDefined();
    });

    it('saves a generated avatar as soon as it is picked', async () => {
        saved();
        const { wrapper } = await mountAt('/settings');
        const picker = await openPicker(wrapper);
        const option = (testId: string) =>
            picker.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

        expect(picker.querySelector<HTMLButtonElement>('[aria-label="No avatar"]')!.dataset.state).toBe(
            'on',
        );

        option('avatar-option-generated-3')!.click();
        await flushPromises();

        expect(settingsApi.update).toHaveBeenCalledWith({ 'profile.avatar': 'generated-3' });
        expect(option('avatar-option-generated-3')!.dataset.state).toBe('on');
        // Nothing uploaded yet, so there's no upload to pick.
        expect(option('avatar-option-upload')).toBeNull();
    });

    it('uploads an image, then selects and shows it', async () => {
        saved();
        vi.mocked(profileApi.uploadAvatar).mockResolvedValue({
            success: true,
            data: { avatarUrl: 'https://cdn.example/avatars/u1/1.webp' },
        });
        const { wrapper } = await mountAt('/settings');
        await openPicker(wrapper);

        await chooseFile(fileOf('image/jpeg', 3 * 1024 * 1024));

        expect(profileApi.uploadAvatar).toHaveBeenCalledWith('cmVzaXplZA==');
        expect(settingsApi.update).toHaveBeenCalledWith({ 'profile.avatar': 'upload' });
        const upload = dialog()!.querySelector<HTMLButtonElement>(
            '[data-testid="avatar-option-upload"]',
        )!;
        expect(upload.dataset.state).toBe('on');
        expect(upload.querySelector('img')!.getAttribute('src')).toBe(
            'https://cdn.example/avatars/u1/1.webp',
        );
        expect(uploadError()).toBeUndefined();
    });

    it('rejects a file of the wrong type with a message, without uploading', async () => {
        const { wrapper } = await mountAt('/settings');
        await openPicker(wrapper);

        await chooseFile(fileOf('image/gif', 1000));

        expect(uploadError()).toBe('Choose a PNG, JPEG or WebP image.');
        expect(profileApi.uploadAvatar).not.toHaveBeenCalled();
        expect(settingsApi.update).not.toHaveBeenCalled();
    });

    it('rejects a file over 10 MB with a message, without uploading', async () => {
        const { wrapper } = await mountAt('/settings');
        await openPicker(wrapper);

        await chooseFile(fileOf('image/png', 10 * 1024 * 1024 + 1));

        expect(uploadError()).toBe('Choose an image under 10 MB.');
        expect(profileApi.uploadAvatar).not.toHaveBeenCalled();
    });

    it("shows the server's reason when it refuses an upload", async () => {
        vi.mocked(profileApi.uploadAvatar).mockRejectedValue({
            response: { status: 400, data: { success: false, error: 'Avatar must be under 1 MB' } },
        });
        const { wrapper } = await mountAt('/settings');
        await openPicker(wrapper);

        await chooseFile(fileOf('image/png', 2000));

        expect(uploadError()).toBe('Avatar must be under 1 MB');
        expect(settingsApi.update).not.toHaveBeenCalled();
    });
});
