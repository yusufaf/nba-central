import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { CustomArena, CustomArenaPayload } from '@/models/api';

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

const RIBBON = { text: 'GO OWLS', color: '#f59e0b' };

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

const swatch = (label: string) => document.querySelector(`[role="radio"][aria-label="${label}"]`) as HTMLButtonElement;
// A preset toggle, found by its label line (its hint is the second line).
const preset = (label: string) =>
    [...document.querySelectorAll('button')].find((b) => b.querySelector('span')?.textContent?.trim() === label) as
        | HTMLButtonElement
        | undefined;
const pressed = (label: string) => {
    const el = preset(label)!;
    return el.getAttribute('data-state') === 'on' || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true';
};

describe('the Lighting tab (#298)', () => {
    it('starts on Broadcast and White for an arena without lighting', async () => {
        await mountModal(arena());
        await openTab('Lighting');
        expect(document.querySelector('[data-testid="scene-stub"]')).not.toBeNull();
        expect(pressed('Broadcast')).toBe(true);
        expect(pressed('Theater')).toBe(false);
        expect(swatch('White').getAttribute('aria-checked')).toBe('true');
        expect(lastScene().label).toBe("Preview of the arena's lighting");
    });

    it('passes Theater and a tint to the preview', async () => {
        await mountModal(arena());
        await openTab('Lighting');
        await click(preset('Theater')!);
        expect(lastScene().venue).toEqual({ version: 1, lighting: { preset: 'theater', tint: '#ffffff' } });
        await click(swatch('Purple'));
        expect(lastScene().venue).toEqual({ version: 1, lighting: { preset: 'theater', tint: '#a855f7' } });
    });

    it('submits no venue once a new arena is back on standard lighting', async () => {
        await mountModal(null);
        await typeInto('#arena-name', 'Harbor Pavilion');
        await openTab('Lighting');
        await click(preset('Theater')!);
        await click(swatch('Purple'));
        await click(preset('Broadcast')!);
        await click(swatch('White'));
        expect((await submitted()).venue).toBeNull();
    });

    it('keeps the other parts when lighting goes back to standard', async () => {
        await mountModal(arena({ venue: { version: 1, ribbon: RIBBON, lighting: { preset: 'theater', tint: '#ffffff' } } }));
        await openTab('Lighting');
        await click(preset('Broadcast')!);
        expect((await submitted()).venue).toEqual({ version: 1, ribbon: RIBBON });
    });

    it("opens an arena's lighting and submits it unchanged", async () => {
        const lighting = { preset: 'theater', tint: '#22c55e' } as const;
        const editing = arena({ venue: { version: 1, lighting: { ...lighting } } });
        await mountModal(editing);
        await openTab('Lighting');
        expect(pressed('Theater')).toBe(true);
        expect(swatch('Green').getAttribute('aria-checked')).toBe('true');
        expect((await submitted()).venue).toEqual({ version: 1, lighting });
        await click(swatch('Gold'));
        expect(editing.venue).toEqual({ version: 1, lighting });
    });

    it('ignores a click on the chosen preset', async () => {
        await mountModal(arena({ venue: { version: 1, lighting: { preset: 'theater', tint: '#ffffff' } } }));
        await openTab('Lighting');
        await click(preset('Theater')!);
        expect(pressed('Theater')).toBe(true);
        expect((await submitted()).venue).toEqual({ version: 1, lighting: { preset: 'theater', tint: '#ffffff' } });
    });
});
