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

import TeamBuilder from '@/views/TeamBuilder.vue';
import { dataApi, teamApi } from '@/network/api';
import { stashPendingSave, hasPendingSave } from '@/composables/usePendingSave';
import { toast } from 'vue-sonner';
import type { SaveTeamPayload } from '@/models/api';

const PENDING_KEY = 'nba-central:pending-save';

const signedIn = auth.signedIn as ReturnType<typeof ref<boolean>>;
const authLoading = auth.loading as ReturnType<typeof ref<boolean>>;

const draft = (overrides: Partial<SaveTeamPayload> = {}): SaveTeamPayload => ({
    title: 'Dream Team',
    description: 'Custom NBA Team',
    city: 'Seattle',
    roster: [
        {
            slot: 0,
            player: { id: 'jamesle01', fullName: 'LeBron James', first_name: 'LeBron', last_name: 'James' } as never,
        },
    ],
    coach: null,
    gm: null,
    arena: null,
    ...overrides,
});

const makeRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/teambuilder', name: 'teamBuilder', component: { template: '<div />' } },
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

const saveClicked = async () => {
    wrapper!.findComponent({ name: 'TeamBuilderHeader' }).vm.$emit('saveTeam');
    await flushPromises();
};

const signInPrompt = () => wrapper!.findComponent({ name: 'ConfirmDialog' });

beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    signedIn.value = false;
    authLoading.value = false;
    vi.clearAllMocks();
    vi.mocked(teamApi.createTeam).mockResolvedValue({
        success: true,
        data: { teamUUID: 'team-1', username: 'hooper' } as never,
    });
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

describe('Save, signed out', () => {
    it('asks the visitor to sign in instead of sending a request the API would refuse', async () => {
        await mountAt('/teambuilder');

        await saveClicked();

        expect(signInPrompt().props('open')).toBe(true);
        expect(teamApi.createTeam).not.toHaveBeenCalled();
    });

    it('keeps the team through sign-in: stashes it, then goes to sign in', async () => {
        const { router } = await mountAt('/teambuilder');
        await saveClicked();

        signInPrompt().vm.$emit('confirm');
        await flushPromises();

        expect(router.currentRoute.value.path).toBe('/login');
        expect(hasPendingSave()).toBe(true);
        expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!).team).toMatchObject({
            description: 'Custom NBA Team',
            roster: [],
        });
    });

    it('keeps the team through sign-in from a remix link too: leaving the builder is not a discard', async () => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: false, error: 'x' });
        const { router } = await mountAt('/teambuilder?remix=src-1');
        await saveClicked();

        signInPrompt().vm.$emit('confirm');
        await flushPromises();

        expect(router.currentRoute.value.path).toBe('/login');
        expect(hasPendingSave()).toBe(true);
    });

    it('offers to create an account, and keeps the team through that too', async () => {
        const { router } = await mountAt('/teambuilder');
        await saveClicked();

        await wrapper!.find('[data-testid="sign-up-to-save"]').trigger('click');
        await flushPromises();

        expect(router.currentRoute.value.path).toBe('/sign-up');
        expect(hasPendingSave()).toBe(true);
    });

    it('stays put and says so when the team cannot be kept', async () => {
        const { router } = await mountAt('/teambuilder');
        await saveClicked();
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        signInPrompt().vm.$emit('confirm');
        await flushPromises();

        expect(router.currentRoute.value.path).toBe('/teambuilder');
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("can't be kept"));
        vi.restoreAllMocks();
    });
});

describe('Save, signed in', () => {
    it('saves straight away, with no prompt', async () => {
        signedIn.value = true;
        await mountAt('/teambuilder');

        await saveClicked();

        expect(signInPrompt().props('open')).toBe(false);
        expect(teamApi.createTeam).toHaveBeenCalledTimes(1);
    });

    it('waits for the session to load instead of asking a signed-in user to sign in', async () => {
        authLoading.value = true;
        await mountAt('/teambuilder');
        const saving = saveClicked();
        await flushPromises();
        expect(signInPrompt().props('open')).toBe(false);

        signedIn.value = true;
        authLoading.value = false;
        await saving;
        await flushPromises();

        expect(signInPrompt().props('open')).toBe(false);
        expect(teamApi.createTeam).toHaveBeenCalledTimes(1);
    });

    it('clears a draft left from an earlier sign-in once a save succeeds', async () => {
        signedIn.value = true;
        await mountAt('/teambuilder');
        stashPendingSave(draft());

        await saveClicked();

        expect(hasPendingSave()).toBe(false);
    });
});

describe('Returning from sign-in (?resume=save)', () => {
    beforeEach(() => {
        signedIn.value = true;
    });

    it('restores the team and saves it, then clears the draft and the flag', async () => {
        stashPendingSave(draft());

        const { router } = await mountAt('/teambuilder?resume=save');

        expect(teamApi.createTeam).toHaveBeenCalledTimes(1);
        const sent = vi.mocked(teamApi.createTeam).mock.calls[0][0];
        expect(sent).toMatchObject({ title: 'Dream Team', city: 'Seattle' });
        expect(sent.roster.map((entry) => entry.player.id)).toEqual(['jamesle01']);
        expect(hasPendingSave()).toBe(false);
        expect(router.currentRoute.value.query).toEqual({ team: 'team-1' });
    });

    it('waits for the session to finish loading before deciding who is signed in', async () => {
        stashPendingSave(draft());
        signedIn.value = false;
        authLoading.value = true;
        const router = makeRouter();
        await router.push('/teambuilder?resume=save');
        wrapper = shallowMount(TeamBuilder, { global: { plugins: [createPinia(), router] } });
        await flushPromises();
        expect(teamApi.createTeam).not.toHaveBeenCalled();

        signedIn.value = true;
        authLoading.value = false;
        await flushPromises();

        expect(teamApi.createTeam).toHaveBeenCalledTimes(1);
    });

    it('says so, and saves nothing, when the draft is gone', async () => {
        const { router } = await mountAt('/teambuilder?resume=save');

        expect(teamApi.createTeam).not.toHaveBeenCalled();
        expect(toast.info).toHaveBeenCalled();
        expect(router.currentRoute.value.query.resume).toBeUndefined();
    });

    it('does not save a draft that has expired', async () => {
        stashPendingSave(draft(), Date.now() - 31 * 60 * 1000);

        await mountAt('/teambuilder?resume=save');

        expect(teamApi.createTeam).not.toHaveBeenCalled();
    });

    it('keeps the draft when the save fails, so a refresh can try again', async () => {
        stashPendingSave(draft());
        vi.mocked(teamApi.createTeam).mockResolvedValue({ success: false, error: 'nope' });

        const { router } = await mountAt('/teambuilder?resume=save');

        expect(teamApi.createTeam).toHaveBeenCalledTimes(1);
        expect(hasPendingSave()).toBe(true);
        expect(router.currentRoute.value.query.team).toBeUndefined();
    });

    it('does not save if the visitor moved to another team while the players loaded', async () => {
        stashPendingSave(draft());
        let finishStats!: () => void;
        vi.mocked(dataApi.getPlayerStats).mockImplementationOnce(
            () => new Promise((resolve) => { finishStats = () => resolve({ success: true, data: [], ratingHistory: [] } as never); }),
        );
        vi.mocked(teamApi.getTeam).mockResolvedValue({ success: false, error: 'x' });
        const { router } = await mountAt('/teambuilder?resume=save');

        await router.push('/teambuilder?team=other');
        finishStats();
        await flushPromises();

        expect(teamApi.createTeam).not.toHaveBeenCalled();
    });
});

describe('A draft that nobody resumed', () => {
    it('is discarded when the builder opens without ?resume, so a later sign-in cannot save it', async () => {
        stashPendingSave(draft());

        await mountAt('/teambuilder');

        expect(hasPendingSave()).toBe(false);
    });

    it.each(['/teambuilder?remix=src-1', '/teambuilder?team=t-9'])('is discarded when the builder opens on %s', async (url) => {
        vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: false, error: 'x' });
        vi.mocked(teamApi.getTeam).mockResolvedValue({ success: false, error: 'x' });
        stashPendingSave(draft());

        await mountAt(url);

        expect(hasPendingSave()).toBe(false);
    });

    it('is discarded, not saved, when ?resume lands signed out', async () => {
        stashPendingSave(draft());
        signedIn.value = false;

        await mountAt('/teambuilder?resume=save');

        expect(teamApi.createTeam).not.toHaveBeenCalled();
        expect(hasPendingSave()).toBe(false);
    });
});
