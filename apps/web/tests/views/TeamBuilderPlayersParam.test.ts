import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import type { PlayerRecord } from '@/models/api';

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
    dataApi: {
        getPlayers: vi.fn(),
        getPlayerStats: vi.fn(async () => ({ success: true, data: [], ratingHistory: [] })),
    },
    teamApi: { createTeam: vi.fn(), updateTeam: vi.fn(), getTeam: vi.fn(), getPublicTeam: vi.fn() },
    customArenaApi: { list: vi.fn(async () => ({ success: true, data: { customArenas: [] } })) },
}));
vi.mock('@/network/teamSeasons', () => ({
    getTeamSeasonsIndex: vi.fn(),
    getCurrentTeamSeason: vi.fn(),
    getTeamSeasonFile: vi.fn(),
}));
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    return { useCurrentUser: () => ({ currentUser: ref(null) }) };
});
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/attribution', () => ({ landingSource: vi.fn(() => 'direct') }));

import TeamBuilder from '@/views/TeamBuilder.vue';
import { dataApi, teamApi } from '@/network/api';
import { getCurrentTeamSeason, getTeamSeasonsIndex } from '@/network/teamSeasons';
import { track } from '@/lib/analytics';
import { toast } from 'vue-sonner';
import historicalJerseysData from '@/assets/data/historicalJerseys.json';
import type { HistoricalJersey } from '@/models/types';
import { mediaIdFromJerseyUrl } from '@/utils/historicalJersey';

const POSITIONS: Record<string, string[]> = { a: ['C'], b: ['PG'], c: ['SF'], d: ['SG'], e: ['PF'] };

const record = (id: string): PlayerRecord =>
    ({
        id,
        first_name: id,
        last_name: 'Test',
        position: 'G',
        positions: POSITIONS[id],
        team: { full_name: '', abbreviation: '' },
        height_feet: 6,
        height_inches: 6,
        weight_pounds: 200,
        active: false,
    }) as PlayerRecord;

let unknown = new Set<string>();

// getPlayers answers the ids it knows, plus a stranger, as an older Lambda
// that ignored `ids` would.
const answerIds = () =>
    vi.mocked(dataApi.getPlayers).mockImplementation(async (params) => ({
        data: [...(params?.ids?.split(',') ?? []).filter((id) => !unknown.has(id)).map(record), record('stranger01')],
        nextCursor: null,
        total: 0,
    }));

const makeRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/teambuilder', name: 'teamBuilder', component: { template: '<div />' } },
            { path: '/', component: { template: '<div />' } },
        ],
    });

let wrapper: VueWrapper | null = null;

const mountAt = async (url: string) => {
    const router = makeRouter();
    await router.push(url);
    await router.isReady();
    wrapper = shallowMount(TeamBuilder, { global: { plugins: [createPinia(), router], renderStubDefaultSlot: true } });
    await flushPromises();
    return { router, wrapper };
};

const header = () => wrapper!.findComponent({ name: 'TeamBuilderHeader' });
const rosterIds = () => {
    const players = wrapper!.findComponent({ name: 'RosterSection' }).props('selectedPlayers') as Map<number, { id: string }>;
    return [...players].sort(([a], [b]) => a - b).map(([slot, p]) => `${slot}:${p.id}`);
};

const jerseyRow = (historicalJerseysData as HistoricalJersey[]).find((r) => r.slot === 'home-road')!;
const mediaId = mediaIdFromJerseyUrl(jerseyRow.jersey)!;

beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(teamApi.getTeam).mockResolvedValue({ success: false } as never);
    vi.mocked(getTeamSeasonsIndex).mockRejectedValue(new Error('no index in this test'));
    vi.mocked(getCurrentTeamSeason).mockResolvedValue(null);
    unknown = new Set();
    answerIds();
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

describe('/teambuilder?players=', () => {
    it('opens a new team with those players in the starting five, each at a position they play', async () => {
        await mountAt('/teambuilder?players=a,b,c,d,e');
        expect(dataApi.getPlayers).toHaveBeenCalledWith({ ids: 'a,b,c,d,e' });
        expect(rosterIds()).toEqual(['1:b', '2:d', '3:c', '4:e', '5:a']);
        expect(header().props('teamUuid')).toBeNull();
        expect(header().props('teamName')).toBe('');
        expect(track).toHaveBeenCalledWith('players_loaded', { requested: 5, loaded: 5, source: 'direct' });
    });

    it("drops an id getPlayers doesn't know and says how many loaded", async () => {
        unknown = new Set(['c', 'e']);
        await mountAt('/teambuilder?players=a,b,c,d,e');
        expect(rosterIds()).toEqual(['1:b', '2:d', '5:a']);
        expect(toast.info).toHaveBeenCalledWith('3 of the 5 players could be loaded');
        expect(track).toHaveBeenCalledWith('players_loaded', { requested: 5, loaded: 3, source: 'direct' });
    });

    it('says so when none of the players can be loaded', async () => {
        vi.mocked(dataApi.getPlayers).mockResolvedValue({ data: [], nextCursor: null, total: 0 });
        await mountAt('/teambuilder?players=a,b');
        expect(toast.error).toHaveBeenCalledWith("Couldn't load those players");
        expect(rosterIds()).toEqual([]);
    });

    it('says so when the lookup fails', async () => {
        vi.mocked(dataApi.getPlayers).mockRejectedValue(new Error('503'));
        await mountAt('/teambuilder?players=a,b');
        expect(toast.error).toHaveBeenCalledWith('Failed to load those players');
        expect(rosterIds()).toEqual([]);
    });

    it('is a plain new team when the list names no one', async () => {
        await mountAt('/teambuilder?players=,,');
        expect(dataApi.getPlayers).not.toHaveBeenCalled();
        expect(track).toHaveBeenCalledWith('builder_opened', { entry: 'new' });
    });

    it('loses to ?team=', async () => {
        await mountAt('/teambuilder?team=t1&players=a');
        expect(teamApi.getTeam).toHaveBeenCalledWith('t1');
        expect(dataApi.getPlayers).not.toHaveBeenCalledWith({ ids: 'a' });
    });

    it('loses to ?real=', async () => {
        await mountAt('/teambuilder?real=CHI-1996&players=a');
        expect(getTeamSeasonsIndex).toHaveBeenCalled();
        expect(dataApi.getPlayers).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('Failed to load that team');
    });

    it('wins over ?jersey=', async () => {
        await mountAt(`/teambuilder?players=a&jersey=${mediaId}`);
        expect(rosterIds()).toEqual(['5:a']);
        expect(header().props('teamJersey')).toBe('');
    });

    it('drops a slower load once the URL asks for other players', async () => {
        let releaseFirst: () => void = () => {};
        vi.mocked(dataApi.getPlayers).mockImplementationOnce(
            (params) =>
                new Promise((resolve) => {
                    releaseFirst = () =>
                        resolve({ data: (params?.ids?.split(',') ?? []).map(record), nextCursor: null, total: 0 });
                }),
        );
        const { router } = await mountAt('/teambuilder?players=a,b');
        await router.push('/teambuilder?players=c');
        await flushPromises();
        releaseFirst();
        await flushPromises();
        expect(rosterIds()).toEqual(['3:c']);
    });

    it('reports builder_opened as players', async () => {
        await mountAt('/teambuilder?players=a');
        expect(track).toHaveBeenCalledWith('builder_opened', { entry: 'players' });
    });
});
