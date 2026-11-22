import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import type { CustomArena, CustomArenaPayload, VenueDesign } from '@/models/api';

const mocks = vi.hoisted(() => ({ webgl: true, scene: [] as Record<string, unknown>[] }));

vi.mock('@/components/scene3d', async () => {
    const { defineComponent, h } = await import('vue');
    return {
        TeamScene3DAsync: defineComponent({
            name: 'TeamScene3DStub',
            props: ['court', 'logoUrl', 'drawingUrl', 'capacity', 'venue', 'label', 'initialPreset', 'presets', 'viewportClass', 'page'],
            setup(props) {
                return () => {
                    mocks.scene.push({ ...props });
                    return h('div', { 'data-testid': 'scene-stub' });
                };
            },
        }),
        Scene3DUnavailable: defineComponent({ name: 'UnavailableStub', setup: () => () => h('p', { 'data-testid': 'unavailable-stub' }) }),
    };
});
vi.mock('@/utils/webgl', () => ({ isWebGLAvailable: () => mocks.webgl }));
vi.mock('@/utils/arenaImage', () => ({
    resizeArenaPhoto: async () => new Blob(['jpg'], { type: 'image/jpeg' }),
    resizeCourtLogo: async () => new Blob(['png'], { type: 'image/png' }),
}));

import CreateCustomArenaModal from '@/components/TeamBuilder/CreateCustomArenaModal.vue';

const VENUE: VenueDesign = {
    version: 1,
    seats: { primary: '#1d4ed8', secondary: '#c9a227', pattern: 'rows' },
    upperDeck: true,
};

const arena = (extra: Partial<CustomArena> = {}): CustomArena => ({
    arenaUUID: 'a1',
    name: 'Harbor Pavilion',
    location: '',
    capacity: 18600,
    openedYear: null,
    court: null,
    created: '2026-10-01T00:00:00.000Z',
    isCustom: true,
    ...extra,
});

let wrapper: VueWrapper | null = null;
const mountModal = async (editingArena: CustomArena | null) => {
    wrapper = mount(CreateCustomArenaModal, {
        props: { open: true, editingArena, 'onUpdate:open': () => {} },
        attachTo: document.body,
    });
    await flushPromises();
    return wrapper;
};

// Reka's tab triggers switch on mousedown, not click.
const openTab = async (label: string) => {
    const trigger = [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === label)!;
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await flushPromises();
};
const button = (label: string) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === label) as
        | HTMLButtonElement
        | undefined;
const click = async (element: HTMLElement) => {
    element.click();
    await flushPromises();
};
const typeInto = async (selector: string, value: string) => {
    const input = document.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await flushPromises();
};
const submitted = async () => {
    await click(document.querySelector('button[type="submit"]') as HTMLButtonElement);
    return (wrapper!.emitted('submit') as [CustomArenaPayload][]).at(-1)![0];
};
const lastScene = () => mocks.scene.at(-1)!;
const upperDeck = () => document.getElementById('seat-upper-deck') as HTMLButtonElement;

beforeEach(() => {
    mocks.webgl = true;
    mocks.scene.length = 0;
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
});

describe('the Seats tab', () => {
    it("shows the standard bowl and Design the seats for a new arena, which saves no venue", async () => {
        await mountModal(null);
        await typeInto('#arena-name', 'Harbor Pavilion');
        await openTab('Seats');
        expect(document.querySelector('[data-testid="scene-stub"]')).not.toBeNull();
        expect(button('Design the seats')).toBeDefined();
        expect(lastScene().venue).toBeNull();
        expect((await submitted()).venue).toBeNull();
    });

    it('designs, edits and submits a venue', async () => {
        await mountModal(arena());
        await openTab('Seats');
        await click(button('Design the seats')!);
        expect(lastScene().venue).toEqual({
            version: 1,
            seats: { primary: '#2a3140', secondary: '#b91c1c', pattern: 'solid' },
            upperDeck: true,
        });

        await click(button('Sections')!);
        await typeInto('input[aria-label="Secondary colour hex"]', '#123abc');
        await click(upperDeck());

        expect((await submitted()).venue).toEqual({
            version: 1,
            seats: { primary: '#2a3140', secondary: '#123abc', pattern: 'sections' },
            upperDeck: false,
        });
    });

    it("loads an edited arena's venue, and Remove seat design saves none", async () => {
        await mountModal(arena({ venue: VENUE }));
        await openTab('Seats');
        expect(lastScene().venue).toEqual(VENUE);
        expect(upperDeck().getAttribute('aria-checked')).toBe('true');

        await click(button('Remove seat design')!);
        expect(button('Design the seats')).toBeDefined();
        expect((await submitted()).venue).toBeNull();
    });

    it("doesn't change the arena it was given", async () => {
        const editing = arena({ venue: structuredClone(VENUE) });
        await mountModal(editing);
        await openTab('Seats');
        await click(button('Gradient')!);
        expect(editing.venue).toEqual(VENUE);
    });

    it('opens an arena whose venue holds reactive proxies', async () => {
        const venue = reactive({ ...VENUE, seats: reactive({ ...VENUE.seats }) }) as VenueDesign;
        await mountModal(arena({ venue }));
        await openTab('Seats');
        expect(lastScene().venue).toEqual(VENUE);
    });

    it('frames the preview from the broadcast angle, tagged as the arena editor', async () => {
        await mountModal(arena({ venue: VENUE }));
        await openTab('Seats');
        expect(lastScene()).toMatchObject({
            initialPreset: 'broadcast',
            presets: ['broadcast', 'courtside', 'rafters', 'banners'],
            page: 'arena-editor',
            capacity: 18600,
            venue: VENUE,
        });
    });

    it('changes only upperDeck when Upper deck is toggled', async () => {
        await mountModal(arena({ venue: VENUE }));
        await openTab('Seats');
        await click(upperDeck());
        const off = (await submitted()).venue!;
        expect(off.upperDeck).toBe(false);
        expect(Object.keys(off.seats).sort()).toEqual(['pattern', 'primary', 'secondary']);
        expect(off.seats).toEqual(VENUE.seats);

        await click(upperDeck());
        expect((await submitted()).venue).toEqual(VENUE);
    });

    it('gives the preview no capacity while the typed one is invalid', async () => {
        await mountModal(arena({ venue: VENUE }));
        await typeInto('#arena-capacity', 'lots');
        await openTab('Seats');
        expect(lastScene().capacity).toBeNull();
        expect(document.body.textContent).toContain("none set, so it's sized for 18,000 seats");
    });

    it('explains the bowl depth from the capacity', async () => {
        await mountModal(arena({ venue: VENUE }));
        await openTab('Seats');
        expect(document.body.textContent).toContain("The bowl's depth follows the capacity on Details: 18,600 seats.");
    });

    it('shows the no-WebGL notice, and the controls still work', async () => {
        mocks.webgl = false;
        await mountModal(arena());
        await openTab('Seats');
        expect(document.querySelector('[data-testid="unavailable-stub"]')).not.toBeNull();
        expect(document.querySelector('[data-testid="scene-stub"]')).toBeNull();
        await click(button('Design the seats')!);
        await click(button('Rows')!);
        expect((await submitted()).venue?.seats.pattern).toBe('rows');
    });
});
