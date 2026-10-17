import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const auth = vi.hoisted(() => ({ signedIn: null as unknown, loading: null as unknown }));
vi.mock('@logto/vue', async () => {
    const { ref } = await import('vue');
    auth.signedIn = ref(false);
    auth.loading = ref(false);
    return { useLogto: () => ({ isAuthenticated: auth.signedIn, isLoading: auth.loading }) };
});
vi.mock('vue-sonner', () => ({
    toast: Object.assign(vi.fn(), {
        // toast.promise runs the work it is given, as the real one does.
        promise: vi.fn((work: () => Promise<unknown>) => work()),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    }),
}));
vi.mock('@/network/api', () => ({
    dataApi: {
        getPlayerStats: vi.fn(async () => ({ success: true, data: [], ratingHistory: [] })),
    },
    teamApi: {
        createTeam: vi.fn(),
        updateTeam: vi.fn(),
        getTeam: vi.fn(),
        getPublicTeam: vi.fn(),
    },
    customArenaApi: { list: vi.fn(async () => ({ success: true, data: { customArenas: [] } })) },
}));
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    return { useCurrentUser: () => ({ currentUser: ref(null) }) };
});
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/attribution', () => ({ landingSource: vi.fn(() => 'newsletter') }));

import TeamBuilder from '@/views/TeamBuilder.vue';
import { teamApi } from '@/network/api';
import { track } from '@/lib/analytics';
import historicalJerseysData from '@/assets/data/historicalJerseys.json';
import type { HistoricalJersey } from '@/models/types';
import { mediaIdFromJerseyUrl } from '@/utils/historicalJersey';

const signedIn = auth.signedIn as ReturnType<typeof ref<boolean>>;
const authLoading = auth.loading as ReturnType<typeof ref<boolean>>;

const makeRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/teambuilder', name: 'teamBuilder', component: { template: '<div />' } },
            { path: '/teams', component: { template: '<div />' } },
            { path: '/login', component: { template: '<div />' } },
            { path: '/sign-up', component: { template: '<div />' } },
            { path: '/', component: { template: '<div />' } },
        ],
    });

let wrapper: VueWrapper | null = null;

const mountAt = async (url: string) => {
    const router = makeRouter();
    await router.push(url);
    await router.isReady();
    wrapper = shallowMount(TeamBuilder, {
        global: {
            plugins: [createPinia(), router],
            // The sign-in prompt's "Create an account" link lives in the dialog's slot.
            renderStubDefaultSlot: true,
        },
    });
    await flushPromises();
    return { router, wrapper };
};


const row = (historicalJerseysData as HistoricalJersey[]).find((r) => r.slot === 'home-road')!;
const mediaId = mediaIdFromJerseyUrl(row.jersey)!;

const headerJersey = () =>
    wrapper!.findComponent({ name: 'TeamBuilderHeader' }).props('teamJersey');

beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    signedIn.value = false;
    authLoading.value = false;
    vi.clearAllMocks();
    vi.mocked(teamApi.getTeam).mockResolvedValue({ success: false } as never);
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

describe('/teambuilder?jersey=<mediaId>', () => {
    it('opens a blank team wearing that historical jersey', async () => {
        await mountAt(`/teambuilder?jersey=${mediaId}`);
        expect(headerJersey()).toBe(row.jersey);
    });

    it('ignores an unknown id', async () => {
        await mountAt('/teambuilder?jersey=unknown');
        expect(headerJersey()).toBe('');
    });

    it('loses to ?team=', async () => {
        await mountAt(`/teambuilder?team=t1&jersey=${mediaId}`);
        expect(teamApi.getTeam).toHaveBeenCalledWith('t1');
        expect(headerJersey()).toBe('');
    });

    it('keeps the team being built when only the jersey query goes away', async () => {
        const { router } = await mountAt(`/teambuilder?jersey=${mediaId}`);
        const header = wrapper!.findComponent({ name: 'TeamBuilderHeader' });
        header.vm.$emit('update:teamName', 'Spurs Redux');
        await flushPromises();
        await router.push('/teambuilder');
        await flushPromises();
        expect(header.props('teamName')).toBe('Spurs Redux');
        expect(headerJersey()).toBe(row.jersey);
    });

    it('keeps the team when Back returns to the same jersey', async () => {
        const { router } = await mountAt(`/teambuilder?jersey=${mediaId}`);
        const header = wrapper!.findComponent({ name: 'TeamBuilderHeader' });
        header.vm.$emit('update:teamName', 'Spurs Redux');
        await flushPromises();
        await router.push('/teambuilder');
        await flushPromises();
        await new Promise<void>((resolve) => {
            const off = router.afterEach(() => {
                off();
                resolve();
            });
            router.back();
        });
        await flushPromises();
        expect(router.currentRoute.value.query.jersey).toBe(mediaId);
        expect(header.props('teamName')).toBe('Spurs Redux');
    });

    it('keeps the team when Back returns to an unknown jersey id', async () => {
        const { router } = await mountAt('/teambuilder?jersey=bogus');
        const header = wrapper!.findComponent({ name: 'TeamBuilderHeader' });
        header.vm.$emit('update:teamName', 'Bogus Ballers');
        await flushPromises();
        await router.push('/teambuilder');
        await flushPromises();
        await router.push('/teambuilder?jersey=bogus');
        await flushPromises();
        expect(header.props('teamName')).toBe('Bogus Ballers');
    });

    it('applies a new jersey on a stale ?resume= value', async () => {
        const { router } = await mountAt('/teambuilder?resume=stale');
        await router.push(`/teambuilder?resume=stale&jersey=${mediaId}`);
        await flushPromises();
        expect(headerJersey()).toBe(row.jersey);
    });

    it('does not reload a saved team when a jersey query is added to it', async () => {
        const { router } = await mountAt('/teambuilder?team=t1');
        await router.push(`/teambuilder?team=t1&jersey=${mediaId}`);
        await flushPromises();
        expect(teamApi.getTeam).toHaveBeenCalledTimes(1);
    });

    it('starts again for a different jersey', async () => {
        const other = (historicalJerseysData as HistoricalJersey[]).filter((r) => r.slot === 'home-road')[1]!;
        const { router } = await mountAt(`/teambuilder?jersey=${mediaId}`);
        wrapper!.findComponent({ name: 'TeamBuilderHeader' }).vm.$emit('update:teamName', 'Spurs Redux');
        await flushPromises();
        await router.push(`/teambuilder?jersey=${mediaIdFromJerseyUrl(other.jersey)}`);
        await flushPromises();
        expect(headerJersey()).toBe(other.jersey);
        expect(wrapper!.findComponent({ name: 'TeamBuilderHeader' }).props('teamName')).toBe('');
    });

    it('is not a customisation', async () => {
        await mountAt(`/teambuilder?jersey=${mediaId}`);
        expect(vi.mocked(track).mock.calls.filter(([name]) => name === 'team_customized')).toEqual([]);
    });
});
