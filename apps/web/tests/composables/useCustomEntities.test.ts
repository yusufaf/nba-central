import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, type Ref } from 'vue';
import CoachSection from '@/components/TeamBuilder/CoachSection.vue';
import GMSection from '@/components/TeamBuilder/GMSection.vue';
import AddPlayerDialog from '@/components/TeamBuilder/AddPlayerDialog.vue';
import { useCustomCoaches } from '@/composables/useCustomCoaches';
import { useCustomGMs } from '@/composables/useCustomGMs';
import { useCustomPlayers } from '@/composables/useCustomPlayers';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('vue-sonner', () => ({ toast }));

const api = vi.hoisted(() => ({ coach: { list: vi.fn() }, gm: { list: vi.fn() }, player: { list: vi.fn() } }));
vi.mock('@/network/api', () => ({
    customCoachApi: api.coach,
    customGMApi: api.gm,
    customPlayerApi: api.player,
    dataApi: { getPlayers: vi.fn() },
}));

type TestUser = { id: string; username: string | null; memberSince: Date | null };

// Built in vi.hoisted rather than inside the mock factory: that factory only
// runs once something imports useCurrentUser, and before the fix nothing did.
const { currentUser } = await vi.hoisted(async () => {
    const { ref } = await import('vue');
    return { currentUser: ref<TestUser | null>(null) };
});
vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: () => ({ currentUser }) }));

const signedIn: TestUser = { id: 'user-1', username: 'someone', memberSince: null };

let wrapper: VueWrapper | undefined;

beforeEach(() => {
    vi.clearAllMocks();
    currentUser.value = null;
    api.coach.list.mockResolvedValue({ success: true, data: { customCoaches: [{ name: 'Mine' }] } });
    api.gm.list.mockResolvedValue({ success: true, data: { customGMs: [{ name: 'Mine' }] } });
    api.player.list.mockResolvedValue({ success: true, data: { customPlayers: [{ name: 'Mine' }] } });
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = '';
});

describe('custom coaches, GMs and players signed out (#225)', () => {
    beforeEach(() => {
        const unauthorized = Object.assign(new Error('Request failed with status code 401'), {
            response: { status: 401 },
        });
        api.coach.list.mockRejectedValue(unauthorized);
        api.gm.list.mockRejectedValue(unauthorized);
        api.player.list.mockRejectedValue(unauthorized);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['CoachSection', CoachSection, { selectedDrawerSide: 'right', teamCoach: null, showCoachDrawer: false }, api.coach],
        ['GMSection', GMSection, { selectedDrawerSide: 'right', teamGM: null, showGMDrawer: false }, api.gm],
        ['AddPlayerDialog', AddPlayerDialog, { open: false, selectedDrawerSide: 'right' }, api.player],
    ] as const)('%s makes no request and shows no toast for a signed-out visitor', async (_name, component, props, entityApi) => {
        wrapper = mount(component as never, { props });
        await flushPromises();

        expect(entityApi.list).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });
});

describe('loading follows the session', () => {
    const mountComposable = (useEntities: () => Record<string, unknown>) => {
        const host = defineComponent({
            setup() {
                return { state: useEntities() };
            },
            render: () => h('div'),
        });
        wrapper = mount(host);
        return (wrapper.vm as unknown as { state: Record<string, Ref<unknown>> }).state;
    };

    const cases = [
        ['useCustomCoaches', useCustomCoaches, api.coach, 'customCoaches'],
        ['useCustomGMs', useCustomGMs, api.gm, 'customGMs'],
        ['useCustomPlayers', useCustomPlayers, api.player, 'customPlayers'],
    ] as const;

    it.each(cases)('%s loads once the session resolves, and clears on sign-out', async (_name, useEntities, entityApi, key) => {
        const state = mountComposable(useEntities);
        await flushPromises();
        expect(entityApi.list).not.toHaveBeenCalled();
        expect(state[key].value).toEqual([]);

        currentUser.value = signedIn;
        await flushPromises();
        expect(entityApi.list).toHaveBeenCalledTimes(1);
        expect(state[key].value).toEqual([{ name: 'Mine' }]);

        currentUser.value = null;
        await flushPromises();
        expect(state[key].value).toEqual([]);
        expect(entityApi.list).toHaveBeenCalledTimes(1);
    });

    it.each(cases)('%s loads straight away when already signed in', async (_name, useEntities, entityApi) => {
        currentUser.value = signedIn;
        mountComposable(useEntities);
        await flushPromises();
        expect(entityApi.list).toHaveBeenCalledTimes(1);
    });
});
