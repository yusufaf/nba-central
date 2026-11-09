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
    emits: ['removePlayer', 'addPlayer', 'pickup'],
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

describe('jersey numbers and the uniform override', () => {
    const UNIFORM = { primary: '#aa0000', secondary: '#ffffff', trim: '#000000' };
    const NUMBERED = {
        ...TEAM,
        roster: [
            { ...TEAM.roster[0], number: '7' },
            { ...TEAM.roster[1], number: '23' },
            TEAM.roster[2],
        ],
        uniform: UNIFORM,
    };
    const numberOf = (id: string) => (scene().props('people') as { id: string; number?: string }[]).find((p) => p.id === id)?.number;
    const undo = async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
        await flushPromises();
    };
    const roster = () => wrapper!.findComponent(RosterStub);

    beforeEach(() => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: NUMBERED } as never);
    });

    it('a remixed team keeps its numbers and uniform in the scene', async () => {
        await mountAt('/teambuilder?remix=t-1');
        expect(numberOf('player-1')).toBe('23');
        expect(numberOf('player-2')).toBe('7');
        expect(scene().props('uniform')).toEqual(UNIFORM);
    });

    it('the header gets the numbers, the uniform and the rostered players', async () => {
        await mountAt('/teambuilder?remix=t-1');
        const header = wrapper!.findComponent({ name: 'TeamBuilderHeader' });
        expect(header.props('teamNumbers')).toEqual({ 1: '23', 2: '7' });
        expect(header.props('teamUniform')).toEqual(UNIFORM);
        expect(header.props('roster')).toEqual([
            { slot: 1, label: 'PG', name: 'One Point' },
            { slot: 2, label: 'SG', name: 'Two Guard' },
            { slot: 6, label: 'Bench', name: 'Six Bench' },
        ]);
    });

    it('editing numbers and the uniform shows in the scene', async () => {
        await mountAt('/teambuilder');
        const header = wrapper!.findComponent({ name: 'TeamBuilderHeader' });
        header.vm.$emit('update:teamUniform', UNIFORM);
        await flushPromises();
        expect(scene().props('uniform')).toEqual(UNIFORM);
        header.vm.$emit('update:teamUniform', null);
        await flushPromises();
        expect(scene().props('uniform')).toBeNull();
    });

    it('removing a player drops their number; undo brings it back', async () => {
        await mountAt('/teambuilder?remix=t-1');
        roster().vm.$emit('removePlayer', 1);
        await flushPromises();
        await undo();
        expect(numberOf('player-1')).toBe('23');

        roster().vm.$emit('removePlayer', 1);
        await flushPromises();
        roster().vm.$emit('addPlayer', 1);
        await flushPromises();
        wrapper!.findComponent({ name: 'AddPlayerDialog' }).vm.$emit('select', { id: 'x', first_name: 'New', last_name: 'Guy', fullName: 'New Guy' });
        await flushPromises();
        expect(numberOf('player-1')).toBeUndefined();
    });

    it("replacing a player clears the slot's number; undo brings it back", async () => {
        await mountAt('/teambuilder?remix=t-1');
        roster().vm.$emit('addPlayer', 1);
        await flushPromises();
        wrapper!.findComponent({ name: 'AddPlayerDialog' }).vm.$emit('select', { id: 'x', first_name: 'New', last_name: 'Guy', fullName: 'New Guy' });
        await flushPromises();
        expect(numberOf('player-1')).toBeUndefined();

        await undo();
        expect(numberOf('player-1')).toBe('23');
    });

    it('swapping two starters swaps their numbers', async () => {
        await mountAt('/teambuilder?remix=t-1');
        roster().vm.$emit('pickup', 1);
        roster().vm.$emit('pickup', 2);
        await flushPromises();
        const people = scene().props('people') as { id: string; name: string; number?: string }[];
        expect(people.slice(0, 2).map(({ id, name, number }) => ({ id, name, number }))).toEqual([
            { id: 'player-1', name: 'Two Guard', number: '7' },
            { id: 'player-2', name: 'One Point', number: '23' },
        ]);
    });
});
