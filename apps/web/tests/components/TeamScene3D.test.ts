import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { h } from 'vue';
import type { CourtDesign } from '@/models/api';

const mocks = vi.hoisted(() => ({
    scenes: [] as Array<{
        setCourt: ReturnType<typeof vi.fn>;
        setBowl: ReturnType<typeof vi.fn>;
        setMotion: ReturnType<typeof vi.fn>;
        setPreset: ReturnType<typeof vi.fn>;
        requestRender: ReturnType<typeof vi.fn>;
        dispose: ReturnType<typeof vi.fn>;
        renderCount: number;
        onRender: (() => void) | null;
        setPeople: ReturnType<typeof vi.fn>;
    }>,
    anchors: [] as Array<{ id: string; x: number; y: number; depth: number; visible: boolean }>,
    kit: { primary: '#123456', secondary: '#654321', trim: '#ffffff' },
    loadJersey: vi.fn(),
    rasterise: vi.fn(),
    track: vi.fn(),
    contextListener: null as ((lost: boolean) => void) | null,
    unsubscribe: vi.fn(),
    failToStart: false,
    failPeople: false,
    lostAtStart: false,
}));

vi.mock('@/three/scene/teamScene', () => ({
    TeamScene: class {
        setCourt = vi.fn();
        setBowl = vi.fn();
        setMotion = vi.fn();
        setPreset = vi.fn();
        requestRender = vi.fn();
        dispose = vi.fn();
        setPeople = vi.fn(async () => {
            if (mocks.failPeople) throw new Error('body.glb failed to load');
        });
        labelAnchors = () => mocks.anchors;
        renderCount = 0;
        onRender: (() => void) | null = null;
        constructor() {
            if (mocks.failToStart) throw new Error('Error creating WebGL context.');
            mocks.scenes.push(this);
        }
    },
}));
// The scene's motion rule (reduced motion, touch screens) is a ref the tests flip.
const motionMock = await vi.hoisted(async () => {
    const { ref } = await import('vue');
    return { motion: ref(true) };
});
vi.mock('@/components/scene3d/sceneMotion', () => ({ useSceneMotion: () => motionMock.motion }));
vi.mock('@/three/arena/rasteriseCourt', () => ({ rasteriseCourt: mocks.rasterise }));
vi.mock('@/three/renderer/shared', () => ({
    isContextLost: () => mocks.lostAtStart,
    onContextChange: (listener: (lost: boolean) => void) => {
        mocks.contextListener = listener;
        return mocks.unsubscribe;
    },
}));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));
vi.mock('@/utils/jerseyColours', () => ({ loadJerseyColours: (url?: string) => mocks.loadJersey(url) }));

import TeamScene3D from '@/components/scene3d/TeamScene3D.vue';
import Scene3DUnavailable from '@/components/scene3d/Scene3DUnavailable.vue';
import { RESTORE_TIMEOUT_MS } from '@/components/scene3d/contextWatch';
import CourtFloor from '@/components/court/CourtFloor.vue';

const COURT: CourtDesign = {
    version: 1,
    wood: 'honey',
    paint: '#0f5257',
    apron: '#0f5257',
    lines: '#f4f1e8',
    centerLogo: 'upload',
    baselineText: 'OWLS',
    sidelineText: '',
};

const canvas = (name: string) => Object.assign(document.createElement('canvas'), { id: name });

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

let wrapper: VueWrapper | null = null;
const mountScene = (props: Record<string, unknown> = {}) => {
    wrapper = mount(TeamScene3D, {
        props: { court: COURT, logoUrl: 'https://cdn/logo.png', drawingUrl: 'https://cdn/drawing.png', capacity: 18000, label: 'Owls court', ...props },
        attachTo: document.body,
    });
    return wrapper;
};
const scene = () => mocks.scenes[mocks.scenes.length - 1];

describe('TeamScene3D', () => {
    beforeEach(() => {
        mocks.scenes.length = 0;
        mocks.rasterise.mockReset();
        mocks.track.mockReset();
        mocks.loadJersey.mockReset();
        mocks.loadJersey.mockImplementation(async () => mocks.kit);
        mocks.unsubscribe.mockReset();
        mocks.contextListener = null;
        mocks.failToStart = false;
        mocks.failPeople = false;
        mocks.lostAtStart = false;
        motionMock.motion.value = true;
    });
    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
    });

    it('passes the motion rule to the scene before building the bowl', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mountScene();
        await flushPromises();
        expect(scene().setMotion).toHaveBeenCalledWith(true);
        expect(scene().setMotion.mock.invocationCallOrder[0]).toBeLessThan(scene().setBowl.mock.invocationCallOrder[0]);
    });

    it('starts the scene still when motion is off', async () => {
        motionMock.motion.value = false;
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mountScene();
        await flushPromises();
        expect(scene().setMotion).toHaveBeenCalledWith(false);
    });

    it('follows the motion rule as it changes', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mountScene();
        await flushPromises();
        scene().setMotion.mockClear();
        motionMock.motion.value = false;
        await flushPromises();
        expect(scene().setMotion).toHaveBeenCalledWith(false);
    });

    it('renders one button per preset and marks the active one', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        const buttons = w.findAll('button');
        expect(buttons.map((b) => b.text())).toEqual(['Team photo', 'Courtside', 'Broadcast', 'Rafters']);
        expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
    });

    it('clicking a preset sets it and tracks scene3d_preset', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        await w.findAll('button')[2].trigger('click');
        expect(scene().setPreset).toHaveBeenCalledWith('broadcast');
        expect(mocks.track).toHaveBeenCalledWith('scene3d_preset', { preset: 'broadcast' });
        expect(w.findAll('button')[2].attributes('aria-pressed')).toBe('true');
    });

    it('falls back to the court without its logo when the first rasterise fails', async () => {
        const second = canvas('second');
        mocks.rasterise.mockResolvedValueOnce(null).mockResolvedValueOnce(second);
        const w = mountScene();
        await flushPromises();
        expect(scene().setCourt).toHaveBeenCalledWith(second);
        const floor = w.findComponent(CourtFloor);
        expect(floor.props('logoUrl')).toBeUndefined();
        expect(floor.props('drawingUrl')).toBe('https://cdn/drawing.png');
    });

    it('falls back to the court without its drawing when the logo was not the problem', async () => {
        const third = canvas('third');
        mocks.rasterise.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(third);
        const w = mountScene();
        await flushPromises();
        const floor = w.findComponent(CourtFloor);
        expect(floor.props('logoUrl')).toBeUndefined();
        expect(floor.props('drawingUrl')).toBeUndefined();
        expect(scene().setCourt).toHaveBeenCalledWith(third);
    });

    it('gives the scene no court only when every attempt fails', async () => {
        mocks.rasterise.mockResolvedValue(null);
        mountScene();
        await flushPromises();
        expect(mocks.rasterise).toHaveBeenCalledTimes(3);
        expect(scene().setCourt).toHaveBeenCalledWith(null);
    });

    it('a stale rasterise never lands', async () => {
        const first = deferred<HTMLCanvasElement | null>();
        const second = deferred<HTMLCanvasElement | null>();
        mocks.rasterise.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const w = mountScene();
        await flushPromises();
        await w.setProps({ court: { ...COURT, wood: 'walnut' } });
        await flushPromises();
        const newer = canvas('newer');
        second.resolve(newer);
        await flushPromises();
        first.resolve(canvas('older'));
        await flushPromises();
        expect(scene().setCourt).toHaveBeenCalledTimes(1);
        expect(scene().setCourt).toHaveBeenCalledWith(newer);
    });

    it('a rasterise finishing after unmount is dropped', async () => {
        const pending = deferred<HTMLCanvasElement | null>();
        mocks.rasterise.mockReturnValueOnce(pending.promise);
        const w = mountScene();
        await flushPromises();
        const created = scene();
        w.unmount();
        wrapper = null;
        pending.resolve(canvas('late'));
        await flushPromises();
        expect(created.setCourt).not.toHaveBeenCalled();
    });

    it('uses the default court when court is null', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene({ court: null });
        await flushPromises();
        expect(w.findComponent(CourtFloor).props('court').centerLogo).toBe('none');
    });

    it('a context loss pauses and tracks scene3d_context_lost, not a failure (#300)', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        mocks.contextListener?.(true);
        await flushPromises();
        expect(w.text()).toContain('3D view paused');
        expect(w.emitted('failed')).toBeUndefined();
        expect(mocks.track).toHaveBeenCalledWith('scene3d_context_lost', {});
        expect(mocks.track).not.toHaveBeenCalledWith('scene3d_failed', expect.anything());
        mocks.contextListener?.(false);
        await flushPromises();
        expect(w.text()).not.toContain('3D view paused');
        expect(scene().requestRender).toHaveBeenCalled();
    });

    it('groups the camera buttons (#300)', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        const group = w.find('[role="group"][aria-label="Camera"]');
        expect(group.findAll('button').map((b) => b.text())).toEqual(['Team photo', 'Courtside', 'Broadcast', 'Rafters']);
    });

    it('keeps one status region and only changes its text (#300)', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        const status = () => w.find('[role="status"]');
        const region = status().element;
        expect(status().text()).toBe('');
        mocks.contextListener?.(true);
        await flushPromises();
        expect(status().element).toBe(region);
        expect(status().text()).toBe('3D view paused');
        mocks.contextListener?.(false);
        await flushPromises();
        expect(status().element).toBe(region);
        expect(status().text()).toBe('');
    });

    it('opens paused when the context is already lost (#300)', async () => {
        mocks.lostAtStart = true;
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        expect(w.text()).toContain('3D view paused');
        expect(mocks.track).toHaveBeenCalledWith('scene3d_context_lost', {});
    });

    it('falls back to the context-lost note after the timeout (#300)', async () => {
        vi.useFakeTimers();
        try {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene();
            await flushPromises();
            mocks.contextListener?.(true);
            await flushPromises();
            vi.advanceTimersByTime(RESTORE_TIMEOUT_MS);
            await flushPromises();
            expect(w.findComponent(Scene3DUnavailable).props('reason')).toBe('context-lost');
            expect(scene().dispose).toHaveBeenCalled();
            expect(w.emitted('failed')).toEqual([['context-lost']]);
            expect(mocks.track).toHaveBeenCalledWith('scene3d_failed', { reason: 'context-lost' });
        } finally {
            vi.useRealTimers();
        }
    });

    it('a renderer that cannot start shows the unavailable card and tracks no-webgl', async () => {
        mocks.failToStart = true;
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        expect(w.text()).toContain("This browser can't show the 3D view.");
        expect(w.findAll('button')).toHaveLength(0);
        expect(mocks.track).toHaveBeenCalledWith('scene3d_failed', { reason: 'no-webgl' });
        expect(mocks.rasterise).not.toHaveBeenCalled();
    });

    it('unmount disposes the scene', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const w = mountScene();
        await flushPromises();
        const created = scene();
        w.unmount();
        wrapper = null;
        expect(created.dispose).toHaveBeenCalledTimes(1);
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('passes people and the sampled kit to the scene', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const people = [{ id: 'player-1', name: 'Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        mountScene({ people, jerseyUrl: 'https://cdn/jersey.png', teamName: 'Owls' });
        await flushPromises();
        expect(scene().setPeople).toHaveBeenCalledWith(people, { colours: mocks.kit, teamName: 'Owls' });
    });

    it('uses the uniform override instead of the sampled kit', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const uniform = { primary: '#aa0000', secondary: '#ffffff', trim: '#000000' };
        const people = [{ id: 'player-1', name: 'Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        mountScene({ people, jerseyUrl: 'https://cdn/jersey.png', teamName: 'Owls', uniform });
        await flushPromises();
        expect(scene().setPeople).toHaveBeenCalledWith(people, { colours: uniform, teamName: 'Owls' });
    });

    it("an older jersey's colours landing last never win (#304)", async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const loads = { 'https://cdn/a.png': deferred<typeof mocks.kit>(), 'https://cdn/b.png': deferred<typeof mocks.kit>() };
        mocks.loadJersey.mockImplementation((url: keyof typeof loads) => loads[url].promise);
        const people = [{ id: 'player-1', name: 'Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        const w = mountScene({ people, jerseyUrl: 'https://cdn/a.png', teamName: 'Owls' });
        await flushPromises();
        await w.setProps({ jerseyUrl: 'https://cdn/b.png' });
        await flushPromises();
        const coloursB = { primary: '#bbbbbb', secondary: '#000000', trim: '#ffffff' };
        loads['https://cdn/b.png'].resolve(coloursB);
        await flushPromises();
        loads['https://cdn/a.png'].resolve({ primary: '#aaaaaa', secondary: '#000000', trim: '#ffffff' });
        await flushPromises();
        expect(scene().setPeople).toHaveBeenCalledTimes(1);
        expect(scene().setPeople).toHaveBeenCalledWith(people, { colours: coloursB, teamName: 'Owls' });
    });

    it('a uniform change re-places people', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const people = [{ id: 'player-1', name: 'Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        const w = mountScene({ people, teamName: 'Owls' });
        await flushPromises();
        const uniform = { primary: '#aa0000', secondary: '#ffffff', trim: '#000000' };
        await w.setProps({ uniform });
        await flushPromises();
        expect(scene().setPeople).toHaveBeenLastCalledWith(people, { colours: uniform, teamName: 'Owls' });
    });

    it('renders a chip per visible anchor and none for hidden ones', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mocks.anchors = [
            { id: 'player-1', x: 100, y: 50, depth: 0.51, visible: true },
            { id: 'coach', x: 0, y: 0, depth: 0.52, visible: false },
        ];
        const people = [
            { id: 'player-1', name: 'Jordan Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 },
            { id: 'coach', name: 'Hale', role: 'coach', heightInches: null, weightPounds: null },
        ];
        const w = mountScene({ people, teamName: 'Owls' });
        await flushPromises();
        scene().onRender?.();
        await flushPromises();
        const chips = w.findAll('[data-testid="name-chip"]');
        expect(chips.map((c) => c.text())).toEqual(['Jordan Vance · PG']);
        mocks.anchors = [];
    });

    it('hides the name chips while paused (#304)', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mocks.anchors = [{ id: 'player-1', x: 100, y: 50, depth: 0.53, visible: true }];
        const people = [{ id: 'player-1', name: 'Jordan Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        const w = mountScene({ people, teamName: 'Owls' });
        await flushPromises();
        scene().onRender?.();
        await flushPromises();
        const chips = () => w.findAll('[data-testid="name-chip"]');
        expect(chips()).toHaveLength(1);
        mocks.contextListener?.(true);
        await flushPromises();
        expect(w.text()).toContain('3D view paused');
        expect(chips()).toHaveLength(0);
        mocks.contextListener?.(false);
        scene().onRender?.();
        await flushPromises();
        expect(chips()).toHaveLength(1);
        mocks.anchors = [];
    });

    it("a frame where nothing moved doesn't re-render (#304)", async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mocks.anchors = [{ id: 'player-1', x: 100, y: 50, depth: 0.5, visible: true }];
        const people = [{ id: 'player-1', name: 'Jordan Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        const updates = vi.fn();
        wrapper = mount(TeamScene3D, {
            props: { court: COURT, capacity: 18000, label: 'Owls court', people, teamName: 'Owls' },
            attachTo: document.body,
            global: {
                mixins: [
                    {
                        updated(this: { $: { type: { __name?: string } } }) {
                            if (this.$.type.__name === 'TeamScene3D') updates();
                        },
                    },
                ],
            },
        });
        await flushPromises();
        scene().onRender?.();
        await flushPromises();
        updates.mockClear();

        scene().renderCount = 5;
        scene().onRender?.();
        await flushPromises();
        expect(updates).not.toHaveBeenCalled();
        expect(wrapper.find('[role="img"]').attributes('data-render-count')).toBe('5');

        mocks.anchors = [{ ...mocks.anchors[0], x: 120 }];
        scene().onRender?.();
        await flushPromises();
        expect(updates).toHaveBeenCalled();
        mocks.anchors = [];
    });

    it('shows surnames only when the view is phone-narrow', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mocks.anchors = [{ id: 'player-1', x: 10, y: 10, depth: 0.54, visible: true }];
        const people = [{ id: 'player-1', name: 'Jordan Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        const w = mountScene({ people, teamName: 'Owls' });
        await flushPromises();
        Object.defineProperty(w.find('[role="img"]').element, 'clientWidth', { configurable: true, value: 390 });
        scene().onRender?.();
        await flushPromises();
        expect(w.find('[data-testid="name-chip"]').text()).toBe('Vance');
        mocks.anchors = [];
    });

    it('truncates long names', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mocks.anchors = [{ id: 'player-1', x: 10, y: 10, depth: 0.55, visible: true }];
        const people = [{ id: 'player-1', name: 'A Very Long Player Name Indeed', role: 'player', position: 'SF', heightInches: null, weightPounds: null }];
        const w = mountScene({ people, teamName: 'Owls' });
        await flushPromises();
        scene().onRender?.();
        await flushPromises();
        const chip = w.find('[data-testid="name-chip"]');
        expect(chip.classes()).toEqual(expect.arrayContaining(['truncate', 'max-w-[9rem]']));
        mocks.anchors = [];
    });

    it('strips a name suffix from the compact chip', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        mocks.anchors = [
            { id: 'player-1', x: 10, y: 10, depth: 0.56, visible: true },
            { id: 'player-2', x: 60, y: 10, depth: 0.57, visible: true },
        ];
        const people = [
            { id: 'player-1', name: 'Jaren Jackson Jr.', role: 'player', position: 'PF', heightInches: 82, weightPounds: 242 },
            { id: 'player-2', name: 'Gary Payton II', role: 'player', position: 'SG', heightInches: 75, weightPounds: 195 },
        ];
        const w = mountScene({ people, teamName: 'Owls' });
        await flushPromises();
        Object.defineProperty(w.find('[role="img"]').element, 'clientWidth', { configurable: true, value: 390 });
        scene().onRender?.();
        await flushPromises();
        expect(w.findAll('[data-testid="name-chip"]').map((c) => c.text())).toEqual(['Jackson', 'Payton']);
        mocks.anchors = [];
    });

    it('a failed people build tracks scene3d_failed and keeps the arena', async () => {
        mocks.rasterise.mockResolvedValue(canvas('a'));
        const people = [{ id: 'player-1', name: 'Vance', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 }];
        mocks.failPeople = true;
        const w = mountScene({ people, teamName: 'Owls' });
        await flushPromises();
        expect(mocks.track).toHaveBeenCalledWith('scene3d_failed', { reason: 'people' });
        expect(w.find('[role="img"]').exists()).toBe(true);
    });

    describe('the venue and the editor preview (#295)', () => {
        const VENUE = { version: 1, seats: { primary: '#111111', secondary: '#eeeeee', pattern: 'rows' }, upperDeck: true } as const;

        it('builds the bowl from the capacity and venue before the court lands', async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            mountScene({ venue: VENUE });
            await flushPromises();
            expect(scene().setBowl).toHaveBeenCalledWith(18000, VENUE);
            expect(scene().setBowl.mock.invocationCallOrder[0]).toBeLessThan(scene().setCourt.mock.invocationCallOrder[0]);
        });

        it('rebuilds only the bowl when the venue changes', async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene();
            await flushPromises();
            await w.setProps({ venue: VENUE });
            await flushPromises();
            expect(scene().setBowl).toHaveBeenLastCalledWith(18000, VENUE);
            expect(mocks.rasterise).toHaveBeenCalledTimes(1);
            expect(scene().setCourt).toHaveBeenCalledTimes(1);
        });

        it('rebuilds only the bowl when the capacity changes', async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene();
            await flushPromises();
            await w.setProps({ capacity: 5000 });
            await flushPromises();
            expect(scene().setBowl).toHaveBeenLastCalledWith(5000, null);
            expect(mocks.rasterise).toHaveBeenCalledTimes(1);
        });

        it('re-rasterises when the court changes', async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene();
            await flushPromises();
            await w.setProps({ court: { ...COURT, wood: 'walnut' } });
            await flushPromises();
            expect(mocks.rasterise).toHaveBeenCalledTimes(2);
            expect(scene().setCourt).toHaveBeenCalledTimes(2);
        });

        it('starts on the initial preset', async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene({ initialPreset: 'broadcast' });
            await flushPromises();
            expect(scene().setPreset).toHaveBeenCalledWith('broadcast');
            const pressed = w.findAll('button').filter((b) => b.attributes('aria-pressed') === 'true');
            expect(pressed.map((b) => b.text())).toEqual(['Broadcast']);
        });

        it('offers only the given presets', async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene({ presets: ['broadcast', 'courtside', 'rafters'] });
            await flushPromises();
            expect(w.findAll('button').map((b) => b.text())).toEqual(['Broadcast', 'Courtside', 'Rafters']);
        });

        describe('the Banners shot (#322)', () => {
            const BANNER = { kind: 'title', title: 'CHAMPIONS', subtitle: '1998', color: '#1d2a44' } as const;
            const texts = (w: VueWrapper) => w.findAll('button').map((b) => b.text());

            it('is offered only when the venue has a banner', async () => {
                mocks.rasterise.mockResolvedValue(canvas('a'));
                let w = mountScene();
                await flushPromises();
                expect(texts(w)).toEqual(['Team photo', 'Courtside', 'Broadcast', 'Rafters']);
                w.unmount();

                w = mountScene({ venue: { version: 1, banners: [BANNER] } });
                await flushPromises();
                expect(texts(w)).toEqual(['Team photo', 'Courtside', 'Broadcast', 'Rafters', 'Banners']);
                w.unmount();

                w = mountScene({ venue: { version: 1, banners: [{ ...BANNER, color: 'gold' }] } });
                await flushPromises();
                expect(texts(w)).not.toContain('Banners');
            });

            it('appears when a banner is added', async () => {
                mocks.rasterise.mockResolvedValue(canvas('a'));
                const w = mountScene();
                await flushPromises();
                await w.setProps({ venue: { version: 1, banners: [BANNER] } });
                expect(texts(w)).toContain('Banners');
            });

            it('never starts on it without banners', async () => {
                mocks.rasterise.mockResolvedValue(canvas('a'));
                const w = mountScene({ initialPreset: 'banners', presets: ['broadcast', 'rafters', 'banners'] });
                await flushPromises();
                expect(scene().setPreset).toHaveBeenCalledWith('broadcast');
                expect(scene().setPreset).not.toHaveBeenCalledWith('banners');
                const pressed = w.findAll('button').filter((b) => b.attributes('aria-pressed') === 'true');
                expect(pressed.map((b) => b.text())).toEqual(['Broadcast']);
            });

            it('falls back to the starting shot, untracked, when the last banner goes', async () => {
                mocks.rasterise.mockResolvedValue(canvas('a'));
                const w = mountScene({ initialPreset: 'broadcast', venue: { version: 1, banners: [BANNER] } });
                await flushPromises();
                await w.findAll('button').find((b) => b.text() === 'Banners')!.trigger('click');
                expect(scene().setPreset).toHaveBeenLastCalledWith('banners');
                expect(mocks.track).toHaveBeenCalledTimes(1);
                mocks.track.mockClear();

                await w.setProps({ venue: { version: 1 } });
                await flushPromises();
                expect(scene().setPreset).toHaveBeenLastCalledWith('broadcast');
                const pressed = w.findAll('button').filter((b) => b.attributes('aria-pressed') === 'true');
                expect(pressed.map((b) => b.text())).toEqual(['Broadcast']);
                expect(texts(w)).not.toContain('Banners');
                expect(mocks.track).not.toHaveBeenCalled();
            });
        });

        it("tags its events with the page when one is given", async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene({ page: 'arena-editor' });
            await flushPromises();
            await w.findAll('button')[2].trigger('click');
            expect(mocks.track).toHaveBeenCalledWith('scene3d_preset', { preset: 'broadcast', page: 'arena-editor' });
        });

        it('gives every preset button type="button"', async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const w = mountScene();
            await flushPromises();
            for (const button of w.findAll('button')) expect(button.attributes('type')).toBe('button');
        });

        it("doesn't submit a form it sits in", async () => {
            mocks.rasterise.mockResolvedValue(canvas('a'));
            const onSubmit = vi.fn((event: Event) => event.preventDefault());
            wrapper = mount(
                {
                    render: () =>
                        h('form', { onSubmit }, [h(TeamScene3D, { court: COURT, capacity: 18000, label: 'Owls court' })]),
                },
                { attachTo: document.body },
            );
            await flushPromises();
            for (const button of wrapper.findAll('button')) (button.element as HTMLButtonElement).click();
            await flushPromises();
            expect(onSubmit).not.toHaveBeenCalled();
        });
    });
});
