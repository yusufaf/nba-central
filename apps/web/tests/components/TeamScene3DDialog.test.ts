import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { ScenePerson } from '@/components/scene3d/people';

const mocks = vi.hoisted(() => ({
    track: vi.fn(),
    probe: vi.fn(),
    webgl: true,
    mounts: 0,
    unmounts: 0,
    liveProps: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/analytics', () => ({ track: mocks.track }));
vi.mock('@/utils/webgl', () => ({
    isWebGLAvailable: () => {
        mocks.probe();
        return mocks.webgl;
    },
}));
vi.mock('@/components/scene3d', async () => {
    const { defineComponent, h, onUnmounted } = await import('vue');
    return {
        TeamScene3DAsync: defineComponent({
            name: 'TeamScene3DStub',
            props: ['court', 'logoUrl', 'drawingUrl', 'capacity', 'label', 'people', 'jerseyUrl', 'teamName'],
            setup(props) {
                mocks.mounts++;
                // The live reactive props, so later prop changes are visible.
                mocks.liveProps = props;
                onUnmounted(() => mocks.unmounts++);
                return () => h('div', { 'data-testid': 'scene-stub' });
            },
        }),
        Scene3DUnavailable: defineComponent({
            props: ['reason'],
            setup: (props) => () => h('p', { 'data-testid': 'unavailable' }, props.reason),
        }),
    };
});

import TeamScene3DDialog from '@/components/TeamBuilder/TeamScene3DDialog.vue';
import { sceneLabel } from '@/components/scene3d/people';

const COURT = {
    version: 1 as const,
    wood: 'maple' as const,
    paint: '#4b2a7b',
    apron: '#4b2a7b',
    lines: '#ffffff',
    centerLogo: 'none' as const,
    baselineText: '',
    sidelineText: '',
};
const PEOPLE: ScenePerson[] = [
    { id: 'player-1', name: 'One', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 },
    { id: 'player-2', name: 'Two', role: 'player', position: 'SG', heightInches: null, weightPounds: null },
    { id: 'coach', name: 'Hale', role: 'coach', heightInches: null, weightPounds: null },
];
const PROPS = {
    court: COURT,
    logoUrl: 'https://cdn/logo.png',
    drawingUrl: undefined,
    capacity: 19200,
    people: PEOPLE,
    jerseyUrl: 'https://cdn/jersey.png',
    teamName: 'Owls',
};

let wrapper: VueWrapper | null = null;
const mountDialog = () => {
    wrapper = mount(TeamScene3DDialog, { props: PROPS, attachTo: document.body });
    return wrapper;
};
const trigger = () => document.querySelector<HTMLButtonElement>('[data-testid="view-3d-button"]')!;
// DialogContent teleports to document.body and can't take a data-testid.
const dialog = () => document.querySelector('[role="dialog"]');
const open = async () => {
    trigger().focus();
    trigger().click();
    await flushPromises();
};
const close = async () => {
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
};

describe('TeamScene3DDialog', () => {
    beforeEach(() => {
        mocks.track.mockReset();
        mocks.probe.mockReset();
        mocks.webgl = true;
        mocks.mounts = 0;
        mocks.unmounts = 0;
        mocks.liveProps = null;
    });
    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
        document.body.innerHTML = '';
    });

    it('closed: no scene and no WebGL probe', () => {
        mountDialog();
        expect(trigger()).not.toBeNull();
        expect(dialog()).toBeNull();
        expect(mocks.mounts).toBe(0);
        expect(mocks.probe).not.toHaveBeenCalled();
    });

    it("opening mounts the scene with the team's props", async () => {
        mountDialog();
        await open();
        expect(dialog()).not.toBeNull();
        expect(mocks.mounts).toBe(1);
        expect(mocks.liveProps).toMatchObject({
            court: COURT,
            capacity: 19200,
            people: PEOPLE,
            jerseyUrl: 'https://cdn/jersey.png',
            teamName: 'Owls',
            logoUrl: 'https://cdn/logo.png',
            label: sceneLabel('Owls', PEOPLE),
        });
        expect(mocks.track).toHaveBeenCalledWith('scene3d_view_clicked', { on: true, page: 'builder' });
        expect(mocks.track).toHaveBeenCalledWith('scene3d_opened', { page: 'builder' });
    });

    it('closing unmounts the scene and returns focus to the button', async () => {
        mountDialog();
        await open();
        await close();
        expect(mocks.unmounts).toBe(1);
        expect(dialog()).toBeNull();
        expect(document.activeElement).toBe(trigger());
    });

    it('prop changes while open reach the scene', async () => {
        const w = mountDialog();
        await open();
        const fewer = PEOPLE.slice(0, 1);
        await w.setProps({ people: fewer, teamName: 'New' });
        await flushPromises();
        expect(mocks.liveProps?.people).toEqual(fewer);
        expect(mocks.liveProps?.label).toBe(sceneLabel('New', fewer));
        expect(mocks.mounts).toBe(1);
    });

    it('without WebGL: the unavailable card, scene3d_failed once over two opens, no scene3d_opened', async () => {
        mocks.webgl = false;
        mountDialog();
        await open();
        expect(document.querySelector('[data-testid="unavailable"]')?.textContent).toBe('no-webgl');
        expect(mocks.mounts).toBe(0);
        await close();
        await open();
        const failed = mocks.track.mock.calls.filter(([event]) => event === 'scene3d_failed');
        expect(failed).toEqual([['scene3d_failed', { reason: 'no-webgl' }]]);
        expect(mocks.track).not.toHaveBeenCalledWith('scene3d_opened', expect.anything());
    });
});
