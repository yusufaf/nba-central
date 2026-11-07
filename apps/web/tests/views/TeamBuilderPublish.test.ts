import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const order = vi.hoisted(() => [] as string[]);

vi.mock('@logto/vue', async () => {
    const { ref } = await import('vue');
    return { useLogto: () => ({ isAuthenticated: ref(true), isLoading: ref(false) }) };
});
vi.mock('vue-sonner', () => ({
    toast: Object.assign(vi.fn(), {
        // Runs the work, as the real one does, and notes when it settles.
        promise: vi.fn((work: () => Promise<unknown>) =>
            work().then(
                () => order.push('toast'),
                () => order.push('toast-error'),
            ),
        ),
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
        publish: vi.fn(),
    },
    customArenaApi: { list: vi.fn(async () => ({ success: true, data: { customArenas: [] } })) },
}));
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    return { useCurrentUser: () => ({ currentUser: ref(null) }) };
});
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/composables/teamCard', () => ({ renderTeamCard: vi.fn() }));

import TeamBuilder from '@/views/TeamBuilder.vue';
import { teamApi } from '@/network/api';
import { renderTeamCard } from '@/composables/teamCard';
import { track } from '@/lib/analytics';
import type { CardStyle, PublishTeamPayload } from '@/models/api';

type Rendered = { png: string | null; rendered: CardStyle | null };

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const storedTeam = (overrides: Record<string, unknown> = {}) => ({
    teamUUID: 'team-a',
    username: 'hooper',
    title: 'Owls',
    description: '',
    city: '',
    country: '',
    logoUrl: '',
    jerseyUrl: '',
    roster: [],
    coach: null,
    gm: null,
    arena: null,
    public: true,
    cardUrl: 'https://cdn/card.png',
    cardStyle: '3d',
    ...overrides,
});

const published = (payload: PublishTeamPayload) => ({
    success: true as const,
    data: {
        ...storedTeam(),
        teamUUID: payload.teamUUID,
        public: payload.public,
        cardUrl: payload.public ? 'https://cdn/card-2.png' : 'https://cdn/card.png',
        ...(payload.cardStyle && { cardStyle: payload.cardStyle }),
    } as never,
});

let wrapper: VueWrapper | null = null;

const mountWith = async (team: Record<string, unknown> | null) => {
    if (team) vi.mocked(teamApi.getTeam).mockResolvedValue({ success: true, data: team as never });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/teambuilder', name: 'teamBuilder', component: { template: '<div />' } },
            { path: '/', component: { template: '<div />' } },
        ],
    });
    await router.push(team ? `/teambuilder?team=${team.teamUUID}` : '/teambuilder');
    await router.isReady();
    wrapper = shallowMount(TeamBuilder, { global: { plugins: [createPinia(), router], renderStubDefaultSlot: true } });
    await flushPromises();
    return wrapper;
};

const header = () => wrapper!.findComponent({ name: 'TeamBuilderHeader' });
const emit = async (event: string, ...args: unknown[]) => {
    header().vm.$emit(event, ...args);
    await flushPromises();
};
const publishCalls = () => vi.mocked(teamApi.publish).mock.calls.map(([payload]) => payload);

beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.clearAllMocks();
    order.length = 0;
    vi.mocked(teamApi.updateTeam).mockResolvedValue({ success: true, data: storedTeam() as never });
    vi.mocked(teamApi.createTeam).mockResolvedValue({
        success: true,
        data: storedTeam({ teamUUID: 'team-b', public: false }) as never,
    });
    vi.mocked(teamApi.publish).mockImplementation(async (payload) => published(payload));
    vi.mocked(renderTeamCard).mockImplementation(async (style) => {
        order.push('render');
        return { png: 'PNG', rendered: style };
    });
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

describe('Publishing a 2D or 3D card', () => {
    it("shows the team's stored card style", async () => {
        await mountWith(storedTeam({ public: false }));
        expect(header().props('cardStyle')).toBe('3d');
    });

    it('publishes the chosen style with its card and says so in analytics', async () => {
        await mountWith(storedTeam({ public: false, cardStyle: undefined }));
        expect(header().props('cardStyle')).toBe('2d');

        await emit('publish', '3d');

        expect(renderTeamCard).toHaveBeenCalledWith('3d', expect.anything(), expect.anything());
        expect(publishCalls()).toEqual([{ teamUUID: 'team-a', public: true, cardPng: 'PNG', cardStyle: '3d' }]);
        expect(track).toHaveBeenCalledWith('team_published', expect.objectContaining({ cardStyle: '3d', cardRendered: '3d' }));
        expect(header().props('cardStyle')).toBe('3d');
        expect(header().props('isPublic')).toBe(true);
    });

    it('keeps 3D as the choice when this publish fell back to the 2D card', async () => {
        await mountWith(storedTeam({ public: false }));
        vi.mocked(renderTeamCard).mockResolvedValue({ png: 'PNG2D', rendered: '2d' });

        await emit('publish', '3d');

        expect(publishCalls()[0]).toMatchObject({ cardPng: 'PNG2D', cardStyle: '3d' });
        expect(track).toHaveBeenCalledWith('team_published', expect.objectContaining({ cardStyle: '3d', cardRendered: '2d' }));
    });
});

describe('Saving a public 3D team', () => {
    it('finishes the save before the card is even drawn, and publishes after it', async () => {
        await mountWith(storedTeam());
        const render = deferred<Rendered>();
        vi.mocked(renderTeamCard).mockImplementation(() => {
            order.push('render');
            return render.promise;
        });

        await emit('saveTeam');

        expect(order).toEqual(['toast', 'render']);
        expect(teamApi.publish).not.toHaveBeenCalled();
        expect(header().props('publishing')).toBe(false);

        render.resolve({ png: 'PNG', rendered: '3d' });
        await flushPromises();
        expect(publishCalls()).toEqual([{ teamUUID: 'team-a', public: true, cardPng: 'PNG', cardStyle: '3d' }]);
    });

    it('never re-publishes after a failed save', async () => {
        await mountWith(storedTeam());
        vi.mocked(teamApi.updateTeam).mockResolvedValue({ success: false, error: 'nope' });

        await emit('saveTeam');

        expect(renderTeamCard).not.toHaveBeenCalled();
        expect(teamApi.publish).not.toHaveBeenCalled();
    });

    it('drops the refresh when Unpublish comes during its render', async () => {
        await mountWith(storedTeam());
        const render = deferred<Rendered>();
        vi.mocked(renderTeamCard).mockReturnValueOnce(render.promise);

        await emit('saveTeam');
        await emit('unpublish');
        render.resolve({ png: 'PNG', rendered: '3d' });
        await flushPromises();

        expect(publishCalls().map((call) => call.public)).toEqual([false]);
        expect(header().props('isPublic')).toBe(false);
    });

    it('sends Unpublish only after a refresh already on the wire, so the team ends private', async () => {
        await mountWith(storedTeam());
        const request = deferred<ReturnType<typeof published>>();
        vi.mocked(teamApi.publish).mockImplementationOnce(() => request.promise);

        await emit('saveTeam');
        expect(publishCalls().map((call) => call.public)).toEqual([true]);
        await emit('unpublish');
        expect(publishCalls().map((call) => call.public)).toEqual([true]);

        request.resolve(published(publishCalls()[0]));
        await flushPromises();

        expect(publishCalls().map((call) => call.public)).toEqual([true, false]);
        expect(header().props('isPublic')).toBe(false);
    });

    it("doesn't publish again when a save lands while Unpublish is pending", async () => {
        await mountWith(storedTeam());
        const request = deferred<ReturnType<typeof published>>();
        vi.mocked(teamApi.publish).mockImplementationOnce(() => request.promise);

        await emit('unpublish');
        await emit('saveTeam');
        request.resolve(published(publishCalls()[0]));
        await flushPromises();

        expect(publishCalls().map((call) => call.public)).toEqual([false]);
        expect(header().props('isPublic')).toBe(false);
    });

    it('publishes a new link preview chosen just before the save', async () => {
        await mountWith(storedTeam({ cardStyle: '2d' }));
        const renders: ReturnType<typeof deferred<Rendered>>[] = [];
        vi.mocked(renderTeamCard).mockImplementation(() => {
            const render = deferred<Rendered>();
            renders.push(render);
            return render.promise;
        });

        await emit('publish', '3d');
        await emit('saveTeam');
        for (const render of renders) render.resolve({ png: 'PNG', rendered: '3d' });
        await flushPromises();

        expect(vi.mocked(renderTeamCard).mock.calls.map(([style]) => style)).toEqual(['3d', '3d']);
        expect(publishCalls()).toHaveLength(1);
        expect(publishCalls()[0].cardStyle).toBe('3d');
        expect(header().props('cardStyle')).toBe('3d');
    });

    it('goes back to the stored style after a new link preview failed', async () => {
        await mountWith(storedTeam({ cardStyle: '2d' }));
        vi.mocked(teamApi.publish).mockRejectedValueOnce(new Error('offline'));

        await emit('publish', '3d');
        await emit('saveTeam');

        expect(publishCalls().map((call) => call.cardStyle)).toEqual(['3d', '2d']);
        expect(header().props('cardStyle')).toBe('2d');
    });

    it("lands a left team's refresh on that team only", async () => {
        await mountWith(storedTeam());
        const render = deferred<Rendered>();
        vi.mocked(renderTeamCard).mockReturnValueOnce(render.promise);

        await emit('saveTeam');
        await emit('reset');
        render.resolve({ png: 'PNG', rendered: '3d' });
        await flushPromises();

        expect(publishCalls()).toEqual([{ teamUUID: 'team-a', public: true, cardPng: 'PNG', cardStyle: '3d' }]);
        expect(header().props('isPublic')).toBe(false);
        expect(header().props('cardStyle')).toBe('2d');
        expect(header().props('teamUuid')).toBeNull();

        await emit('saveTeam');
        expect(teamApi.createTeam).toHaveBeenCalledOnce();
        expect(publishCalls()).toHaveLength(1);
    });
});
