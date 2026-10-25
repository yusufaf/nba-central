import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toRaw } from 'vue';
import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@logto/vue', async () => {
    const { ref } = await import('vue');
    return { useLogto: () => ({ isAuthenticated: ref(false), isLoading: ref(false) }) };
});
vi.mock('vue-sonner', () => ({
    toast: Object.assign(vi.fn(), {
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
    dataApi: { getPlayerStats: vi.fn() },
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
vi.mock('@/lib/attribution', () => ({ landingSource: vi.fn(() => null) }));

import TeamBuilder from '@/views/TeamBuilder.vue';
import { dataApi } from '@/network/api';

const getPlayerStats = vi.mocked(dataApi.getPlayerStats);
const LEBRON = { id: 'jamesle01', first_name: 'LeBron', last_name: 'James' };
const SEASON = { season: 2025, games_played: 70, pts: 24.4, reb: 7.8, ast: 8.2 };

let wrapper: VueWrapper | null = null;

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const mountBuilder = async () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/teambuilder', name: 'teamBuilder', component: { template: '<div />' } }],
    });
    await router.push('/teambuilder');
    await router.isReady();
    wrapper = shallowMount(TeamBuilder, {
        global: { plugins: [createPinia(), router], renderStubDefaultSlot: true },
    });
    await flushPromises();
};

const roster = () => wrapper!.findComponent({ name: 'RosterSection' });
const slotPlayer = (slot: number) => roster().props('selectedPlayers').get(slot);

const pick = async (slot: number, player: object) => {
    roster().vm.$emit('addPlayer', slot);
    await flushPromises();
    wrapper!.findComponent({ name: 'AddPlayerDialog' }).vm.$emit('select', player);
    await flushPromises();
};

beforeEach(async () => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await mountBuilder();
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.restoreAllMocks();
});

describe('player stats status', () => {
    it('marks a rejected fetch as failed', async () => {
        getPlayerStats.mockRejectedValueOnce(new Error('timeout'));
        await pick(1, LEBRON);
        expect(slotPlayer(1)).toMatchObject({ statsStatus: 'failed', playerStats: [] });
    });

    it("marks a body that isn't stats (CloudFront's index.html) as failed", async () => {
        getPlayerStats.mockResolvedValueOnce('<!doctype html><html></html>' as never);
        await pick(1, LEBRON);
        expect(slotPlayer(1)).toMatchObject({ statsStatus: 'failed', playerStats: [] });
    });

    it('marks a player the snapshot has not reached as unavailable', async () => {
        getPlayerStats.mockResolvedValueOnce({ data: [], available: false });
        await pick(1, LEBRON);
        expect(slotPlayer(1)).toMatchObject({ statsStatus: 'unavailable', playerStats: [] });
    });

    it('marks an available empty career as ready', async () => {
        getPlayerStats.mockResolvedValueOnce({ data: [], available: true });
        await pick(1, LEBRON);
        expect(slotPlayer(1)).toMatchObject({ statsStatus: 'ready', playerStats: [] });
    });

    it('fetches nothing for a custom player and gives it no status', async () => {
        await pick(6, { isCustom: true, name: 'Custom Guy', fullName: 'Custom Guy', playerUUID: 'p1' });
        expect(getPlayerStats).not.toHaveBeenCalled();
        expect(slotPlayer(6)).toBeDefined();
        expect(slotPlayer(6).statsStatus).toBeUndefined();
    });
});

describe('retryStats', () => {
    it('refetches a failed player in place, keeping the card on the board', async () => {
        getPlayerStats.mockRejectedValueOnce(new Error('timeout'));
        await pick(1, LEBRON);
        const before = toRaw(slotPlayer(1));

        const retry = deferred<{ data: unknown[]; available: boolean }>();
        getPlayerStats.mockReturnValueOnce(retry.promise as never);
        roster().vm.$emit('retryStats', 1);
        await flushPromises();

        expect(slotPlayer(1).statsStatus).toBe('retrying');
        expect(roster().props('pendingPlayers').has(1)).toBe(false);

        roster().vm.$emit('retryStats', 1);
        await flushPromises();
        expect(getPlayerStats).toHaveBeenCalledTimes(2);

        retry.resolve({ data: [SEASON], available: true });
        await flushPromises();

        expect(slotPlayer(1)).toMatchObject({ statsStatus: 'ready', playerStats: [SEASON] });
        expect(toRaw(slotPlayer(1))).toBe(before);
    });

    it('does nothing for a player whose stats loaded', async () => {
        getPlayerStats.mockResolvedValueOnce({ data: [SEASON], available: true });
        await pick(1, LEBRON);

        roster().vm.$emit('retryStats', 1);
        await flushPromises();

        expect(getPlayerStats).toHaveBeenCalledTimes(1);
    });
});
