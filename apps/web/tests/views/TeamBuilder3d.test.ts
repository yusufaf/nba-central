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
import { defineComponent, h } from 'vue';

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

// Renders only the lineup-actions slot, which is where the 3D dialog lives.
const RosterStub = defineComponent({
    name: 'RosterSection',
    emits: ['removePlayer'],
    setup: (_, { slots }) => () => h('div', slots['lineup-actions']?.()),
});

let wrapper: VueWrapper | null = null;

const mountAt = async (url: string) => {
    const router = makeRouter();
    await router.push(url);
    await router.isReady();
    wrapper = shallowMount(TeamBuilder, {
        global: {
            plugins: [createPinia(), router],
            renderStubDefaultSlot: true,
            stubs: { RosterSection: RosterStub },
        },
    });
    await flushPromises();
    return { router, wrapper };
};

const scene = () => wrapper!.findComponent({ name: 'TeamScene3DDialog' });
const ids = () => (scene().props('people') as { id: string }[]).map((p) => p.id);

const TEAM = {
    teamUUID: 't-1',
    title: 'Owls',
    description: '',
    city: '',
    roster: [
        { slot: 2, player: { fullName: 'Two Guard', position: 'SG', heightFeet: 6, heightInches: 5, weightPounds: 200 } },
        { slot: 1, player: { fullName: 'One Point', position: 'PG', heightFeet: 6, heightInches: 1, weightPounds: 180 } },
        { slot: 6, player: { fullName: 'Six Bench', position: 'SF' } },
    ],
    coach: { name: 'Hale' },
    gm: { name: 'Reyes' },
    arena: { name: 'United Center', capacity: '19,200' },
    jerseyUrl: 'https://cdn/jersey.png',
    public: false,
};

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

describe('View in 3D from the builder', () => {
    it('a new signed-out team: the dialog is there with nobody in it', async () => {
        await mountAt('/teambuilder');
        expect(scene().exists()).toBe(true);
        expect(scene().props('people')).toEqual([]);
        expect(scene().props('teamName')).toBe('');
    });

    it('a remixed (unsaved) team: starters in slot order, then coach and GM', async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: TEAM } as never);
        await mountAt('/teambuilder?remix=t-1');
        expect(ids()).toEqual(['player-1', 'player-2', 'coach', 'gm']);
        expect(scene().props('teamName')).toBe('Remix of Owls');
        expect(scene().props('jerseyUrl')).toBe('https://cdn/jersey.png');
        expect(scene().props('capacity')).toBe(19200);
        expect(scene().props('court')).toBeNull();
    });

    it('an unsaved roster change shows: removing slot 2 drops player-2', async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: TEAM } as never);
        await mountAt('/teambuilder?remix=t-1');
        wrapper!.findComponent(RosterStub).vm.$emit('removePlayer', 2);
        await flushPromises();
        expect(ids()).toEqual(['player-1', 'coach', 'gm']);
    });

    it('an unsaved jersey and name change shows', async () => {
        await mountAt('/teambuilder');
        const header = wrapper!.findComponent({ name: 'TeamBuilderHeader' });
        header.vm.$emit('update:teamJersey', 'https://cdn/new.png');
        header.vm.$emit('update:teamName', 'Night Owls');
        await flushPromises();
        expect(scene().props('jerseyUrl')).toBe('https://cdn/new.png');
        expect(scene().props('teamName')).toBe('Night Owls');
    });

    it('a saved unpublished team, signed in, loads the same way', async () => {
        signedIn.value = true;
        vi.mocked(teamApi.getTeam).mockResolvedValue({ success: true, data: TEAM } as never);
        await mountAt('/teambuilder?team=t-1');
        expect(ids()).toEqual(['player-1', 'player-2', 'coach', 'gm']);
        expect(scene().props('teamName')).toBe('Owls');
    });
});
