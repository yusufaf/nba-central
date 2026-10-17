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


const publicTeam = {
    teamUUID: 'src-1',
    username: 'yusuf',
    title: 'Sharers',
    description: '',
    city: 'Chicago',
    country: 'USA',
    logoUrl: '',
    jerseyUrl: '',
    playerCount: 1,
    roster: [{ slot: 1, player: { id: 'jordami01', fullName: 'Michael Jordan', first_name: 'Michael', last_name: 'Jordan' } }],
    coach: null,
    gm: null,
    arena: null,
    createdAt: 1,
    updatedAt: 2,
    public: true,
    publishedAt: 2,
    cardUrl: '',
};

const callsTo = (event: string) => vi.mocked(track).mock.calls.filter(([name]) => name === event);

beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    signedIn.value = false;
    authLoading.value = false;
    vi.clearAllMocks();
    vi.mocked(teamApi.getTeam).mockResolvedValue({ success: false } as never);
    vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: publicTeam } as never);
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

describe('builder_opened', () => {
    it.each([
        ['/teambuilder', 'new'],
        ['/teambuilder?remix=r1', 'remix'],
        ['/teambuilder?team=t1', 'team'],
        ['/teambuilder?jersey=x', 'jersey'],
    ])('reports how %s was entered', async (url, entry) => {
        await mountAt(url);
        expect(callsTo('builder_opened')).toEqual([['builder_opened', { entry }]]);
    });

    it('fires once per visit, not on a query change', async () => {
        const { router } = await mountAt('/teambuilder?team=t1');
        await router.push('/teambuilder');
        await flushPromises();
        expect(callsTo('builder_opened')).toHaveLength(1);
    });
});

describe('player_added', () => {
    const pick = async (slot: number, player: object) => {
        await mountAt('/teambuilder');
        wrapper!.findComponent({ name: 'RosterSection' }).vm.$emit('addPlayer', slot);
        await flushPromises();
        wrapper!.findComponent({ name: 'AddPlayerDialog' }).vm.$emit('select', player);
        await flushPromises();
    };

    it('reports a searched starter', async () => {
        await pick(1, { id: 'jamesle01', first_name: 'LeBron', last_name: 'James' });
        expect(callsTo('player_added')).toEqual([['player_added', { from: 'search', slot: 'starter' }]]);
    });

    it('reports a custom bench player', async () => {
        await pick(6, { isCustom: true, name: 'Custom Guy', fullName: 'Custom Guy', playerUUID: 'p1' });
        expect(callsTo('player_added')).toEqual([['player_added', { from: 'custom', slot: 'bench' }]]);
    });
});

describe('team_customized', () => {
    it('reports each field once, never its value', async () => {
        await mountAt('/teambuilder');
        const header = wrapper!.findComponent({ name: 'TeamBuilderHeader' });
        header.vm.$emit('update:teamName', 'A');
        header.vm.$emit('update:teamName', 'AB');
        wrapper!.findComponent({ name: 'CoachSection' }).vm.$emit('update:teamCoach', { name: 'Phil Jackson' });
        await flushPromises();
        expect(callsTo('team_customized')).toEqual([
            ['team_customized', { field: 'name' }],
            ['team_customized', { field: 'coach' }],
        ]);
        expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(/AB|Phil Jackson/);
    });

    it('sends nothing for a no-op edit', async () => {
        await mountAt('/teambuilder');
        wrapper!.findComponent({ name: 'TeamBuilderHeader' }).vm.$emit('update:teamName', '');
        await flushPromises();
        expect(callsTo('team_customized')).toHaveLength(0);
    });
});

describe('remix_loaded', () => {
    it('carries the landing source', async () => {
        await mountAt('/teambuilder?remix=src-1');
        expect(callsTo('remix_loaded')).toEqual([
            ['remix_loaded', { sourceTeamUUID: 'src-1', source: 'newsletter' }],
        ]);
    });
});
