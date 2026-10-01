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
