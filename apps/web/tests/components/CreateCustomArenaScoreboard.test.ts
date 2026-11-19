import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { CustomArena, CustomArenaPayload, VenueDesign } from '@/models/api';

const mocks = vi.hoisted(() => ({ webgl: true, scene: [] as Record<string, unknown>[], mounts: 0 }));

vi.mock('@/components/scene3d', async () => {
    const { defineComponent, h } = await import('vue');
    return {
        TeamScene3DAsync: defineComponent({
            name: 'TeamScene3DStub',
            props: ['court', 'logoUrl', 'drawingUrl', 'capacity', 'venue', 'label', 'initialPreset', 'presets', 'viewportClass', 'page'],
            setup(props) {
                mocks.mounts++;
                return () => {
                    mocks.scene.push({ ...props });
                    return h('div', { 'data-testid': 'scene-stub' });
                };
            },
        }),
        Scene3DUnavailable: defineComponent({ name: 'UnavailableStub', setup: () => () => h('p') }),
    };
});
vi.mock('@/utils/webgl', () => ({ isWebGLAvailable: () => mocks.webgl }));
vi.mock('@/utils/arenaImage', () => ({
    resizeArenaPhoto: async () => new Blob(['jpg'], { type: 'image/jpeg' }),
    resizeCourtLogo: async () => new Blob(['png'], { type: 'image/png' }),
}));

import CreateCustomArenaModal from '@/components/TeamBuilder/CreateCustomArenaModal.vue';

const SEATS = { primary: '#1d4ed8', secondary: '#c9a227', pattern: 'rows' } as const;
const SCOREBOARD = { text: 'OWLS', accent: '#22c55e' };

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
const submitButton = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;
const submitted = async () => {
    await click(submitButton());
    return (wrapper!.emitted('submit') as [CustomArenaPayload][]).at(-1)![0];
};
const checkbox = (id: string) => document.getElementById(id) as HTMLButtonElement;
const lastScene = () => mocks.scene.at(-1)!;

beforeEach(() => {
    mocks.webgl = true;
    mocks.scene.length = 0;
    mocks.mounts = 0;
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
});

describe('the Scoreboard tab', () => {
    it('starts with both parts off for a new arena, which saves no venue', async () => {
        await mountModal(null);
        await typeInto('#arena-name', 'Harbor Pavilion');
        await openTab('Scoreboard');
        expect(document.querySelector('[data-testid="scene-stub"]')).not.toBeNull();
        expect(checkbox('venue-scoreboard').getAttribute('aria-checked')).toBe('false');
        expect(checkbox('venue-ribbon').getAttribute('aria-checked')).toBe('false');
        expect((await submitted()).venue).toBeNull();
    });

    it("adds a scoreboard from the arena's name, with no seat design", async () => {
        await mountModal(arena());
        await openTab('Scoreboard');
        await click(checkbox('venue-scoreboard'));
        expect((document.getElementById('scoreboard-text') as HTMLInputElement).value).toBe('Harbor Pavilion');
        expect(lastScene().venue).toEqual({ version: 1, scoreboard: { text: 'Harbor Pavilion', accent: '#ef4444' } });
        const venue = (await submitted()).venue!;
        expect(venue).toEqual({ version: 1, scoreboard: { text: 'Harbor Pavilion', accent: '#ef4444' } });
        expect(venue).not.toHaveProperty('seats');
    });

    it('limits the texts with maxlength', async () => {
        await mountModal(arena());
        await openTab('Scoreboard');
        await click(checkbox('venue-scoreboard'));
        await click(checkbox('venue-ribbon'));
        expect(document.getElementById('scoreboard-text')!.getAttribute('maxlength')).toBe('16');
        expect(document.getElementById('ribbon-text')!.getAttribute('maxlength')).toBe('32');
    });

    it('blocks saving a text past its limit', async () => {
        await mountModal(arena());
        await openTab('Scoreboard');
        await click(checkbox('venue-scoreboard'));
        await typeInto('#scoreboard-text', 'x'.repeat(17));
        expect(submitButton().disabled).toBe(true);
        await typeInto('#scoreboard-text', 'x'.repeat(16));
        expect(submitButton().disabled).toBe(false);
    });

    it('trims the texts it submits', async () => {
        await mountModal(arena());
        await openTab('Scoreboard');
        await click(checkbox('venue-ribbon'));
        await typeInto('#ribbon-text', '  Go Owls  ');
        expect((await submitted()).venue).toEqual({ version: 1, ribbon: { text: 'Go Owls', color: '#f59e0b' } });
    });

    it('removes a part when unticked, and the venue once nothing is left', async () => {
        await mountModal(arena({ venue: { version: 1, scoreboard: SCOREBOARD } }));
        await openTab('Scoreboard');
        expect(checkbox('venue-scoreboard').getAttribute('aria-checked')).toBe('true');
        await click(checkbox('venue-scoreboard'));
        expect(document.getElementById('scoreboard-text')).toBeNull();
        expect((await submitted()).venue).toBeNull();
    });

    it('submits seats and a scoreboard together, and Remove seat design keeps the scoreboard', async () => {
        await mountModal(arena({ venue: { version: 1, seats: SEATS, upperDeck: true, scoreboard: SCOREBOARD } }));
        expect((await submitted()).venue).toEqual({ version: 1, seats: SEATS, upperDeck: true, scoreboard: SCOREBOARD });
        await openTab('Seats');
        await click(button('Remove seat design')!);
        expect((await submitted()).venue).toEqual({ version: 1, scoreboard: SCOREBOARD });
    });

    it('keeps one preview across Seats and Scoreboard, showing each edit', async () => {
        await mountModal(arena());
        await openTab('Seats');
        expect(mocks.mounts).toBe(1);
        expect(lastScene().label).toBe("Preview of the arena's seating bowl");
        await openTab('Scoreboard');
        expect(mocks.mounts).toBe(1);
        expect(lastScene().label).toBe("Preview of the arena's scoreboard and ribbon");
        await click(checkbox('venue-ribbon'));
        expect(lastScene().venue).toEqual({ version: 1, ribbon: { text: 'Welcome to Harbor Pavilion', color: '#f59e0b' } });
        await openTab('Details');
        expect(document.querySelector('[data-testid="scene-stub"]')).toBeNull();
    });

    it("never changes the arena being edited", async () => {
        const venue: VenueDesign = { version: 1, scoreboard: { ...SCOREBOARD } };
        const editing = arena({ venue });
        await mountModal(editing);
        await openTab('Scoreboard');
        await typeInto('#scoreboard-text', 'NEW');
        await click(checkbox('venue-ribbon'));
        expect(editing.venue).toEqual({ version: 1, scoreboard: SCOREBOARD });
    });
});
