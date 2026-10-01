import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
const signOut = vi.fn();
vi.mock('@logto/vue', () => ({ useLogto: () => ({ signOut }) }));
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    return {
        useCurrentUser: () => ({ currentUser: ref({ id: 'u1', username: 'hooper' }) }),
    };
});

import Settings from '@/views/Settings.vue';
import { settingsApi } from '@/network/api';
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

beforeEach(async () => {
    settingsSync.stop();
    localStorage.clear();
    vi.clearAllMocks();
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
