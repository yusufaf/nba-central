import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import type { TeamSeasonFile, TeamSeasonsIndex } from '@/models/teamSeasons';

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
import { getCurrentTeamSeason, getTeamSeasonFile, getTeamSeasonsIndex } from '@/network/teamSeasons';
import { track } from '@/lib/analytics';
import { toast } from 'vue-sonner';

const BULLS = ['harpero01', 'jordami01', 'pippesc01', 'rodmade01', 'longllu01', 'kukocto01', 'kerrst01'];
const SONICS = ['paytoga01', 'kempsh01'];

const index: TeamSeasonsIndex = {
    version: 1,
    generatedAt: '',
    seasons: [
        {
            league: 'NBA',
            year: 2008,
            label: '2007-08',
            path: 'team-seasons/NBA-2008.json',
            teams: [{ code: 'SEA', franchise: 'OKC', name: 'Seattle SuperSonics' }],
        },
        {
            league: 'NBA',
            year: 1996,
            label: '1995-96',
            path: 'team-seasons/NBA-1996.json',
            teams: [{ code: 'CHI', franchise: 'CHI', name: 'Chicago Bulls' }],
        },
    ],
};

const seasonFile = (year: number, label: string, team: Partial<TeamSeasonFile['teams'][number]>): TeamSeasonFile => ({
    version: 1,
    league: 'NBA',
    year,
    label,
    generatedAt: '',
    teams: [
        {
            code: 'CHI',
            franchise: 'CHI',
            name: 'Chicago Bulls',
            coachId: 'jacksph01c',
            arena: 'United Center',
            roster: [],
            starters: 5,
            alternates: [],
            ...team,
        },
    ],
});

const files: Record<string, TeamSeasonFile> = {
    'team-seasons/NBA-1996.json': seasonFile(1996, '1995-96', { roster: BULLS, alternates: ['brownra02'] }),
    'team-seasons/NBA-2008.json': seasonFile(2008, '2007-08', {
        code: 'SEA',
        franchise: 'OKC',
        name: 'Seattle SuperSonics',
        coachId: null,
        arena: null,
        roster: SONICS,
        starters: 2,
    }),
};

const record = (id: string) => ({
    id,
    first_name: id.slice(0, 5),
    last_name: 'Test',
    position: 'G',
    team: { full_name: '', abbreviation: '' },
    height_feet: 6,
    height_inches: 6,
    weight_pounds: 200,
    active: false,
});

// getPlayers answers the ids it is asked for, plus a stranger, as an older
// Lambda that ignored `ids` would.
const answerIds = () =>
    vi.mocked(dataApi.getPlayers).mockImplementation(async (params) => ({
        data: [...(params?.ids?.split(',') ?? []).filter((id) => id !== 'kerrst01').map(record), record('stranger01')],
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

beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(teamApi.getTeam).mockResolvedValue({ success: false } as never);
    vi.mocked(getTeamSeasonsIndex).mockResolvedValue(index);
    vi.mocked(getCurrentTeamSeason).mockResolvedValue(null);
    vi.mocked(getTeamSeasonFile).mockImplementation(async (path) => files[path]);
    answerIds();
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

describe('/teambuilder?real=CODE-YEAR', () => {
    it('opens a new team with the roster and identity of that team-season', async () => {
        await mountAt('/teambuilder?real=CHI-1996');
        expect(dataApi.getPlayers).toHaveBeenCalledWith({ ids: [...BULLS, 'brownra02'].join(',') });
        // Kerr is unknown to getPlayers, so the alternate takes his spot; the stranger never lands.
        expect(rosterIds()).toEqual([
            '1:harpero01', '2:jordami01', '3:pippesc01', '4:rodmade01', '5:longllu01', '6:kukocto01', '7:brownra02',
        ]);
        expect(header().props()).toMatchObject({ teamName: '1995-96 Chicago Bulls', teamCity: 'Chicago' });
        expect(header().props('teamLogo')).not.toBe('');
        expect(wrapper!.findComponent({ name: 'CoachSection' }).props('teamCoach')).toMatchObject({ name: 'Phil Jackson*' });
        expect(wrapper!.findComponent({ name: 'GMSection' }).props('teamGM')).toMatchObject({ name: 'Jerry Krause' });
        expect(header().props('teamUuid')).toBeNull();
        expect(track).toHaveBeenCalledWith('real_team_loaded', { team: 'CHI', season: 1996, source: 'direct' });
    });

    it('loads the current season from its own file', async () => {
        vi.mocked(getCurrentTeamSeason).mockResolvedValue(
            seasonFile(2027, '2026-27', { code: 'PHI', franchise: 'PHI', name: 'Philadelphia 76ers', roster: ['jamesle01'], starters: 1 }),
        );
        await mountAt('/teambuilder?real=PHI-2027');
        expect(getTeamSeasonFile).not.toHaveBeenCalled();
        expect(rosterIds()).toEqual(['1:jamesle01']);
        expect(header().props('teamName')).toBe('2026-27 Philadelphia 76ers');
    });

    it.each([
        ['a team-season with no file', 'SEA-1996', "We don't have that team-season"],
        ['a malformed value', 'chi-96', "That link doesn't name a team-season"],
    ])('says so for %s and leaves a blank team', async (_label, param, message) => {
        await mountAt(`/teambuilder?real=${param}`);
        expect(toast.error).toHaveBeenCalledWith(message);
        expect(rosterIds()).toEqual([]);
        expect(header().props('teamName')).toBe('');
    });

    it('says so when none of the players can be loaded', async () => {
        vi.mocked(dataApi.getPlayers).mockResolvedValue({ data: [], nextCursor: null, total: 0 });
        await mountAt('/teambuilder?real=CHI-1996');
        expect(toast.error).toHaveBeenCalledWith("Couldn't load that team's players");
        expect(header().props('teamName')).toBe('');
    });

    it('says so when the files fail to load', async () => {
        vi.mocked(getTeamSeasonsIndex).mockRejectedValue(new Error('503'));
        await mountAt('/teambuilder?real=CHI-1996');
        expect(toast.error).toHaveBeenCalledWith('Failed to load that team');
    });

    it('loses to ?team=', async () => {
        await mountAt('/teambuilder?team=t1&real=CHI-1996');
        expect(teamApi.getTeam).toHaveBeenCalledWith('t1');
        expect(getTeamSeasonsIndex).not.toHaveBeenCalled();
    });

    it('drops a slower load once the URL asks for another team', async () => {
        let releaseBulls: (file: TeamSeasonFile) => void = () => {};
        vi.mocked(getTeamSeasonFile).mockImplementation((path) =>
            path.endsWith('1996.json')
                ? new Promise((resolve) => (releaseBulls = resolve))
                : Promise.resolve(files[path]),
        );
        const { router } = await mountAt('/teambuilder?real=CHI-1996');
        await router.push('/teambuilder?real=SEA-2008');
        await flushPromises();
        releaseBulls(files['team-seasons/NBA-1996.json']);
        await flushPromises();
        expect(header().props('teamName')).toBe('2007-08 Seattle SuperSonics');
        expect(rosterIds()).toEqual(['1:paytoga01', '2:kempsh01']);
    });
});

describe('the real-team picker', () => {
    const picker = () => wrapper!.findComponent({ name: 'RealTeamPicker' });

    it('opens from the header and knows whether the builder holds players', async () => {
        await mountAt('/teambuilder');
        expect(picker().props()).toMatchObject({ open: false, hasRoster: false });
        header().vm.$emit('realTeam');
        await flushPromises();
        expect(picker().props('open')).toBe(true);
    });

    it('puts the pick in the URL', async () => {
        const { router } = await mountAt('/teambuilder');
        picker().vm.$emit('pick', 'SEA-2008');
        await flushPromises();
        expect(router.currentRoute.value.query.real).toBe('SEA-2008');
        expect(track).toHaveBeenCalledWith('real_team_clicked', { team: 'SEA-2008' });
        expect(rosterIds()).toEqual(['1:paytoga01', '2:kempsh01']);
    });

    it('reloads the team already in the URL', async () => {
        await mountAt('/teambuilder?real=SEA-2008');
        header().vm.$emit('update:teamName', 'My Sonics');
        await flushPromises();
        picker().vm.$emit('pick', 'SEA-2008');
        await flushPromises();
        expect(header().props('teamName')).toBe('2007-08 Seattle SuperSonics');
    });
});
