import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';

const mocks = vi.hoisted(() => ({
    route: null as unknown as { query: Record<string, string> },
    replace: vi.fn(),
    track: vi.fn(),
    webgl: true,
    sceneMounts: 0,
    sceneProps: [] as Record<string, unknown>[],
}));

vi.mock('@/network/api', () => ({ teamApi: { getPublicTeam: vi.fn() } }));
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn(), replace: mocks.replace }),
    useRoute: () => mocks.route,
}));
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));
vi.mock('@/utils/webgl', () => ({ isWebGLAvailable: () => mocks.webgl }));
vi.mock('@/components/scene3d', async () => {
    const { defineComponent: define, h: render } = await import('vue');
    return {
        TeamScene3DAsync: define({
            name: 'TeamScene3DStub',
            props: ['court', 'logoUrl', 'drawingUrl', 'capacity', 'label'],
            setup(props) {
                mocks.sceneMounts++;
                mocks.sceneProps.push({ ...props });
                return () => render('div', { 'data-testid': 'scene-stub' });
            },
        }),
        Scene3DUnavailable: define({
            props: ['reason'],
            setup: (props) => () => render('p', { 'data-testid': 'unavailable' }, props.reason),
        }),
    };
});

import PublicTeam from '@/views/PublicTeam.vue';
import { teamApi } from '@/network/api';

const court = (wood: 'maple' | 'walnut') => ({
    version: 1 as const,
    wood,
    paint: '#4b2a7b',
    apron: '#4b2a7b',
    lines: '#ffffff',
    centerLogo: 'none' as const,
    baselineText: '',
    sidelineText: '',
});

const teamWith = (uuid: string, wood: 'maple' | 'walnut') => ({
    teamUUID: uuid,
    username: 'yusuf',
    title: `Team ${uuid}`,
    description: '',
    roster: [],
    coach: null,
    gm: null,
    arena: { name: 'Nest', capacity: 21000, isCustom: true, court: court(wood) },
    createdAt: 1,
    updatedAt: 2,
    public: true,
    publishedAt: 2,
    cardUrl: 'https://cdn/x.png',
});

const mountView = (teamUUID = 't1') =>
    mount(PublicTeam, {
        props: { teamUUID },
        global: { stubs: { PageShell: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }) } },
    });

const button = (wrapper: ReturnType<typeof mountView>, label: string) =>
    wrapper.findAll('button').find((b) => b.text().includes(label));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.route = reactive({ query: {} as Record<string, string> });
    mocks.webgl = true;
    mocks.sceneMounts = 0;
    mocks.sceneProps.length = 0;
    vi.mocked(teamApi.getPublicTeam).mockImplementation(async (uuid: string) => ({
        success: true,
        data: teamWith(uuid, uuid === 't1' ? 'maple' : 'walnut') as never,
    }));
});

describe('PublicTeam ?view=3d', () => {
    it('shows no scene without ?view=3d', async () => {
        const wrapper = mountView();
        await flushPromises();
        expect(wrapper.find('[data-testid="scene-stub"]').exists()).toBe(false);
        expect(button(wrapper, 'View in 3D')).toBeTruthy();
    });

    it("mounts the scene with the arena's court and capacity", async () => {
        mocks.route.query = { view: '3d' };
        const wrapper = mountView();
        await flushPromises();
        expect(wrapper.find('[data-testid="scene-stub"]').exists()).toBe(true);
        expect(mocks.sceneProps.at(-1)).toMatchObject({ court: court('maple'), capacity: 21000 });
        expect(button(wrapper, 'Hide 3D')).toBeTruthy();
    });

    it('the button toggles the query and keeps other params', async () => {
        mocks.route.query = { ref: 'x' };
        const wrapper = mountView();
        await flushPromises();
        await button(wrapper, 'View in 3D')!.trigger('click');
        expect(mocks.replace).toHaveBeenCalledWith({ query: { ref: 'x', view: '3d' } });
        expect(mocks.track).toHaveBeenCalledWith('scene3d_view_clicked', { on: true });
    });

    it('turning it off drops only view', async () => {
        mocks.route.query = { ref: 'x', view: '3d' };
        const wrapper = mountView();
        await flushPromises();
        await button(wrapper, 'Hide 3D')!.trigger('click');
        expect(mocks.replace).toHaveBeenCalledWith({ query: { ref: 'x' } });
    });

    it('navigating to another team remounts the scene with its court', async () => {
        mocks.route.query = { view: '3d' };
        const wrapper = mountView('t1');
        await flushPromises();
        await wrapper.setProps({ teamUUID: 't2' });
        await flushPromises();
        expect(mocks.sceneMounts).toBe(2);
        expect(mocks.sceneProps.at(-1)).toMatchObject({ court: court('walnut') });
    });

    it('without WebGL it shows the unavailable card and tracks no-webgl once', async () => {
        mocks.webgl = false;
        mocks.route.query = { view: '3d' };
        const wrapper = mountView();
        await flushPromises();
        expect(wrapper.find('[data-testid="scene-stub"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="unavailable"]').text()).toBe('no-webgl');
        const noWebgl = mocks.track.mock.calls.filter(([event, data]) => event === 'scene3d_failed' && data?.reason === 'no-webgl');
        expect(noWebgl).toHaveLength(1);
    });

    it('tracks scene3d_opened once per team load', async () => {
        mocks.route.query = { view: '3d' };
        const wrapper = mountView('t1');
        await flushPromises();
        await wrapper.setProps({ teamUUID: 't2' });
        await flushPromises();
        const opened = mocks.track.mock.calls.filter(([event]) => event === 'scene3d_opened');
        expect(opened).toEqual([
            ['scene3d_opened', { page: 'public' }],
            ['scene3d_opened', { page: 'public' }],
        ]);
    });
});
