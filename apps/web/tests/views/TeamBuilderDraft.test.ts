import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { shallowMount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const auth = vi.hoisted(() => ({ signedIn: null as unknown, loading: null as unknown, user: null as unknown }));
vi.mock('@logto/vue', async () => {
    const { ref } = await import('vue');
    auth.signedIn = ref(false);
    auth.loading = ref(false);
    return { useLogto: () => ({ isAuthenticated: auth.signedIn, isLoading: auth.loading }) };
});
vi.mock('@/composables/useCurrentUser', async () => {
    const { ref } = await import('vue');
    auth.user = ref(null);
    return { useCurrentUser: () => ({ currentUser: auth.user }) };
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
        getPlayerStats: vi.fn(async () => ({ success: true, data: [], ratingHistory: [] })),
    },
    teamApi: {
        createTeam: vi.fn(),
        updateTeam: vi.fn(),
        getTeam: vi.fn(),
        getPublicTeam: vi.fn(),
    },
    customArenaApi: { list: vi.fn(async () => ({ success: true, data: { customArenas: [] } })) },
    customPlayerApi: { list: vi.fn(async () => ({ success: true, data: { customPlayers: [] } })) },
}));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import TeamBuilder from '@/views/TeamBuilder.vue';
import { teamApi } from '@/network/api';
import { draftKeyFor, readDraft, saveDraft } from '@/composables/useBuilderDraft';
import { stashPendingSave } from '@/composables/usePendingSave';
import { track } from '@/lib/analytics';
import { toast } from 'vue-sonner';
import type { SaveTeamPayload } from '@/models/api';
import type { CurrentUser } from '@/composables/useCurrentUser';

const signedIn = auth.signedIn as ReturnType<typeof ref<boolean>>;
const authLoading = auth.loading as ReturnType<typeof ref<boolean>>;
const currentUser = auth.user as ReturnType<typeof ref<CurrentUser | null>>;

const GUEST = draftKeyFor(null);
const U1 = draftKeyFor('u1');

const keptTeam = (title = 'Kept Team'): SaveTeamPayload => ({
    title,
    description: '',
    roster: [
        {
            slot: 0,
            player: { id: 'jamesle01', fullName: 'LeBron James', first_name: 'LeBron', last_name: 'James' } as never,
        },
    ],
    coach: null,
    gm: null,
    arena: null,
});

const publicTeam = {
    teamUUID: 'src-1',
    title: 'Their Team',
    username: 'someone',
    roster: [],
    coach: null,
    gm: null,
    arena: null,
};

const makeRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/teambuilder', name: 'teamBuilder', component: { template: '<div />' } },
            { path: '/scores', component: { template: '<div />' } },
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
const teamName = () => header().props('teamName');
const rename = async (name: string) => {
    header().vm.$emit('update:teamName', name);
    await flushPromises();
};
const leave = () => {
    wrapper?.unmount();
    wrapper = null;
};
const restoredToast = () =>
    vi.mocked(toast.success).mock.calls.find(([message]) => message === 'Restored your unsaved team');
const signInAs = (id: string) => {
    signedIn.value = true;
    currentUser.value = { id, username: 'hooper', memberSince: null };
};

beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    localStorage.clear();
    signedIn.value = false;
    authLoading.value = false;
    currentUser.value = null;
    vi.clearAllMocks();
    vi.mocked(teamApi.createTeam).mockResolvedValue({
        success: true,
        data: { teamUUID: 'team-1', username: 'hooper' } as never,
    });
    vi.mocked(teamApi.getPublicTeam).mockResolvedValue({ success: true, data: publicTeam } as never);
});

afterEach(leave);

describe('keeping the unsaved team', () => {
    it('writes an edit to storage once the burst of typing settles', async () => {
        await mountAt('/teambuilder');
        await rename('Night Owls');
        expect(readDraft(GUEST)).toBeNull();

        await new Promise((resolve) => setTimeout(resolve, 600));

        expect(readDraft(GUEST)?.title).toBe('Night Owls');
    });

    it("doesn't wait for the debounce when the builder is left", async () => {
        await mountAt('/teambuilder');
        await rename('Night Owls');
        leave();

        expect(readDraft(GUEST)?.title).toBe('Night Owls');
    });

    it("doesn't let a remix overwrite the kept team just by loading", async () => {
        saveDraft(GUEST, keptTeam());
        await mountAt('/teambuilder?remix=src-1');
        leave();

        expect(readDraft(GUEST)?.title).toBe('Kept Team');
    });

    it('drops the kept team when Clear Team leaves the builder blank', async () => {
        await mountAt('/teambuilder');
        await rename('Night Owls');
        header().vm.$emit('reset');
        await flushPromises();
        leave();

        expect(readDraft(GUEST)).toBeNull();
    });

    it('keeps an edit made just before another team opens in the same visit', async () => {
        const { router } = await mountAt('/teambuilder');
        await rename('Night Owls');
        await router.push('/teambuilder?remix=src-1');
        await flushPromises();

        expect(readDraft(GUEST)?.title).toBe('Night Owls');
    });

    it("doesn't let a write still pending from a closed builder land later", async () => {
        await mountAt('/teambuilder');
        await rename('Night Owls');
        leave();
        localStorage.removeItem(GUEST);

        await new Promise((resolve) => setTimeout(resolve, 600));

        expect(readDraft(GUEST)).toBeNull();
    });

    it("writes a signed-in edit once the user's id arrives", async () => {
        signedIn.value = true;
        await mountAt('/teambuilder');
        await rename('Night Owls');

        currentUser.value = { id: 'u1', username: 'hooper', memberSince: null };
        await flushPromises();

        expect(readDraft(U1)?.title).toBe('Night Owls');
        expect(readDraft(GUEST)).toBeNull();
    });

    it("never writes a signed-in user's team before knowing who they are", async () => {
        signedIn.value = true;
        await mountAt('/teambuilder');
        await rename('Night Owls');
        leave();

        const draftKeys = Object.keys(localStorage).filter((key) => key.startsWith('nba-central:builder-draft:'));
        expect(draftKeys).toEqual([]);
    });
});

describe('bringing it back', () => {
    it('restores it on a bare visit, with a way to start over', async () => {
        saveDraft(GUEST, keptTeam());
        await mountAt('/teambuilder');

        expect(teamName()).toBe('Kept Team');
        expect(track).toHaveBeenCalledWith('draft_restored', { playerCount: 1 });

        const startOver = restoredToast()![1] as { action: { onClick: () => void } };
        startOver.action.onClick();
        await flushPromises();

        expect(teamName()).toBe('');
        expect(readDraft(GUEST)).toBeNull();
    });

    it('leaves it alone when the visit asks for a specific start', async () => {
        saveDraft(GUEST, keptTeam());
        await mountAt('/teambuilder?jersey=unknown-id');

        expect(teamName()).toBe('');
        expect(restoredToast()).toBeUndefined();
        expect(readDraft(GUEST)?.title).toBe('Kept Team');
    });

    it("never offers another account's or a guest's team to a signed-in user", async () => {
        saveDraft(GUEST, keptTeam('Guest Team'));
        saveDraft(draftKeyFor('u2'), keptTeam('Their Team'));
        signInAs('u1');
        await mountAt('/teambuilder');

        expect(teamName()).toBe('');
        expect(restoredToast()).toBeUndefined();
    });

    it("waits for the user's id before restoring their own team", async () => {
        saveDraft(U1, keptTeam());
        signedIn.value = true;
        await mountAt('/teambuilder');
        expect(teamName()).toBe('');

        currentUser.value = { id: 'u1', username: 'hooper', memberSince: null };
        await flushPromises();

        expect(teamName()).toBe('Kept Team');
    });

    it('lets an edit made while the session loads win over the kept team', async () => {
        saveDraft(GUEST, keptTeam());
        authLoading.value = true;
        await mountAt('/teambuilder');
        await rename('Started Fresh');

        authLoading.value = false;
        await flushPromises();

        expect(teamName()).toBe('Started Fresh');
        expect(restoredToast()).toBeUndefined();
    });
});

describe('saving it', () => {
    it('clears the kept team once it is saved, even with no edits since the restore', async () => {
        saveDraft(U1, keptTeam());
        signInAs('u1');
        await mountAt('/teambuilder');
        expect(teamName()).toBe('Kept Team');

        header().vm.$emit('saveTeam');
        await flushPromises();
        leave();

        expect(teamApi.createTeam).toHaveBeenCalledOnce();
        expect(readDraft(U1)).toBeNull();
    });

    it('clears the team built signed out once the sign-in to save it finishes', async () => {
        saveDraft(GUEST, keptTeam('Built Signed Out'));
        saveDraft(U1, keptTeam('Mine From Before'));
        stashPendingSave(keptTeam('Built Signed Out'));
        signInAs('u1');
        await mountAt('/teambuilder?resume=save');
        leave();

        expect(teamApi.createTeam).toHaveBeenCalledOnce();
        expect(readDraft(GUEST)).toBeNull();
        expect(readDraft(U1)?.title).toBe('Mine From Before');
    });

    it('keeps it when a different team is saved', async () => {
        saveDraft(U1, keptTeam());
        signInAs('u1');
        await mountAt('/teambuilder?remix=src-1');

        header().vm.$emit('saveTeam');
        await flushPromises();
        leave();

        expect(readDraft(U1)?.title).toBe('Kept Team');
    });
});
