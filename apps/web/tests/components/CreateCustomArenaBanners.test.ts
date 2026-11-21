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

const RIBBON = { text: 'GO OWLS', color: '#f59e0b' };
const BANNER = { kind: 'title', title: 'CHAMPIONS', subtitle: '1998', color: '#1d2a44' } as const;
const RETIRED = { kind: 'number', title: '23', subtitle: 'JORDAN', color: '#b91c1c' } as const;

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
const byLabel = (label: string) => document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;
const triggers = () =>
    [...document.querySelectorAll('button[aria-controls]')].filter((el) =>
        /^Banner \d/.test(el.textContent?.trim() ?? ''),
    ) as HTMLButtonElement[];
const titleInput = (index: number) => document.getElementById(`banner-${index}-title`) as HTMLInputElement | null;
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

describe('the Banners tab (#297)', () => {
    it('starts empty for a new arena, which saves no venue', async () => {
        await mountModal(null);
        await typeInto('#arena-name', 'Harbor Pavilion');
        await openTab('Banners');
        expect(document.querySelector('[data-testid="scene-stub"]')).not.toBeNull();
        expect(document.body.textContent).toContain('No banners yet');
        expect(document.body.textContent).toContain('0 of 8');
        expect((await submitted()).venue).toBeNull();
    });

    it('adds a banner to a venue that had none, opened for editing', async () => {
        await mountModal(arena());
        await openTab('Banners');
        await click(button('Add banner')!);
        expect(lastScene().venue).toEqual({
            version: 1,
            banners: [{ kind: 'title', title: 'Champions', subtitle: '', color: '#1d2a44' }],
        });
        expect(titleInput(0)!.value).toBe('Champions');
        expect(titleInput(0)!.getAttribute('maxlength')).toBe('16');
        expect(document.getElementById('banner-0-subtitle')!.getAttribute('maxlength')).toBe('24');
    });

    it('stops at eight', async () => {
        await mountModal(arena());
        await openTab('Banners');
        for (let i = 0; i < 8; i++) await click(button('Add banner')!);
        expect(button('Add banner')!.disabled).toBe(true);
        expect(document.body.textContent).toContain('8 of 8');
        expect((lastScene().venue as { banners: unknown[] }).banners).toHaveLength(8);
    });

    it('edits a title into the preview', async () => {
        await mountModal(arena());
        await openTab('Banners');
        await click(button('Add banner')!);
        await typeInto('#banner-0-title', '1998');
        expect((lastScene().venue as { banners: { title: string }[] }).banners[0].title).toBe('1998');
    });

    it('moves a banner down, keeping its panel open and focus on its button', async () => {
        await mountModal(arena({ venue: { version: 1, banners: [{ ...BANNER }, { ...RETIRED }] } }));
        await openTab('Banners');
        await click(triggers()[0]);
        await click(byLabel('Move banner 1 down'));
        expect((lastScene().venue as { banners: unknown[] }).banners).toEqual([RETIRED, BANNER]);
        expect(titleInput(1)!.value).toBe('CHAMPIONS');
        expect(titleInput(0)).toBeNull();
        // Banner 2 is now last, so its Down is disabled and focus moves to Up.
        expect(document.activeElement).toBe(byLabel('Move banner 2 up'));
    });

    it('moves a banner up with focus staying on Up while it can', async () => {
        const banners = [{ ...BANNER }, { ...RETIRED }, { ...BANNER, title: 'WEST' }];
        await mountModal(arena({ venue: { version: 1, banners } }));
        await openTab('Banners');
        await click(triggers()[2]);
        await click(byLabel('Move banner 3 up'));
        expect(titleInput(1)!.value).toBe('WEST');
        expect(document.activeElement).toBe(byLabel('Move banner 2 up'));
    });

    it('removes banners, and the venue once nothing is left', async () => {
        await mountModal(arena({ venue: { version: 1, banners: [{ ...BANNER }] } }));
        await openTab('Banners');
        await click(triggers()[0]);
        await click(byLabel('Remove banner 1'));
        expect(document.body.textContent).toContain('No banners yet');
        expect((await submitted()).venue).toBeNull();
    });

    it('keeps the other parts when the last banner goes', async () => {
        await mountModal(arena({ venue: { version: 1, ribbon: RIBBON, banners: [{ ...BANNER }] } }));
        await openTab('Banners');
        await click(triggers()[0]);
        await click(byLabel('Remove banner 1'));
        expect((await submitted()).venue).toEqual({ version: 1, ribbon: RIBBON });
    });

    it('submits trimmed texts', async () => {
        await mountModal(arena());
        await openTab('Banners');
        await click(button('Add banner')!);
        await typeInto('#banner-0-title', '  1998  ');
        await typeInto('#banner-0-subtitle', '  NBA CHAMPIONS ');
        expect((await submitted()).venue).toEqual({
            version: 1,
            banners: [{ kind: 'title', title: '1998', subtitle: 'NBA CHAMPIONS', color: '#1d2a44' }],
        });
    });

    it('blocks saving a title past its limit', async () => {
        await mountModal(arena());
        await openTab('Banners');
        await click(button('Add banner')!);
        await typeInto('#banner-0-title', 'x'.repeat(17));
        expect(submitButton().disabled).toBe(true);
        await typeInto('#banner-0-title', 'x'.repeat(16));
        expect(submitButton().disabled).toBe(false);
    });

    it('keeps one preview across Seats, Scoreboard and Banners', async () => {
        await mountModal(arena());
        await openTab('Seats');
        await openTab('Scoreboard');
        await openTab('Banners');
        expect(mocks.mounts).toBe(1);
        expect(lastScene().label).toBe("Preview of the arena's rafters banners");
    });

    it('never changes the arena being edited', async () => {
        const venue: VenueDesign = { version: 1, banners: [{ ...BANNER }, { ...RETIRED }] };
        const editing = arena({ venue });
        await mountModal(editing);
        await openTab('Banners');
        await click(triggers()[0]);
        await typeInto('#banner-0-title', 'NEW');
        await click(byLabel('Move banner 1 down'));
        await click(button('Add banner')!);
        expect(editing.venue).toEqual({ version: 1, banners: [BANNER, RETIRED] });
    });
});
