import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PersonInput } from '@/three/character/person';
import type { Player } from '@/models/types';
import { DEFAULT_APPEARANCE } from '@/utils/appearance';
import { BODY_PRESETS } from '@/utils/appearanceOptions';

const mocks = vi.hoisted(() => ({
    renders: [] as { person: PersonInput; label: string }[],
    webgl: true,
    track: vi.fn(),
}));

vi.mock('@/components/scene3d', () => ({
    PersonPreview3DAsync: defineComponent({
        name: 'PreviewStub',
        props: { person: { type: Object, required: true }, label: { type: String, required: true } },
        setup(props) {
            return () => {
                mocks.renders.push({ person: props.person as PersonInput, label: props.label });
                return h('div', { 'data-testid': 'preview-stub' });
            };
        },
    }),
    Scene3DUnavailable: defineComponent({ name: 'UnavailableStub', setup: () => () => h('p', { 'data-testid': 'unavailable-stub' }) }),
}));
vi.mock('@/utils/webgl', () => ({ isWebGLAvailable: () => mocks.webgl }));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));

// jsdom has no ResizeObserver, which reka-ui's Slider uses to measure its thumb.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

import CustomPlayerCreator from '@/components/TeamBuilder/creator/CustomPlayerCreator.vue';

const latest = () => mocks.renders.at(-1)!;
const person = () => latest().person;

let wrapper: VueWrapper | null = null;
const mountCreator = async (editingPlayer: Player | null = null) => {
    wrapper = mount(CustomPlayerCreator, {
        props: { open: true, editingPlayer, 'onUpdate:open': () => {} },
        attachTo: document.body,
    });
    await flushPromises();
    return wrapper;
};

// Reka's tab triggers switch on mousedown, not click.
const openTab = async (label: string) => {
    const trigger = [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === label) as HTMLElement;
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await flushPromises();
};

const button = (label: string) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === label) as HTMLButtonElement;
const startingWith = (label: string) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement;

const click = async (element: HTMLElement) => {
    element.click();
    await flushPromises();
};

const typeInto = async (selector: string, value: string) => {
    const input = document.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await flushPromises();
    return input;
};

const blur = async (input: HTMLInputElement) => {
    input.dispatchEvent(new Event('blur'));
    await flushPromises();
};

const hexInput = (label: string) => document.querySelector(`input[aria-label="${label} hex"]`) as HTMLInputElement;

const submitted = async () => {
    (document.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await flushPromises();
    return (wrapper!.emitted('submit') as unknown[][] | undefined)?.at(-1)?.[0] as Record<string, unknown> & {
        appearance: typeof DEFAULT_APPEARANCE;
    };
};

const custom = (extra: Partial<Player> = {}): Player =>
    ({
        id: 'p1',
        playerUUID: 'p1',
        isCustom: true,
        name: 'Nova Reyes',
        position: 'PG',
        heightFeet: 6,
        heightInches: 3,
        weightPounds: 195,
        overallRating: 88,
        ...extra,
    }) as Player;

beforeEach(() => {
    mocks.renders.length = 0;
    mocks.webgl = true;
    mocks.track.mockClear();
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
});

describe('CustomPlayerCreator', () => {
    it('previews the default player on open', async () => {
        await mountCreator();
        expect(person()).toMatchObject({ id: 'preview', position: 'SG', heightInches: 78, weightPounds: 200, number: null });
        expect(person().appearance).toEqual(DEFAULT_APPEARANCE);
        expect(mocks.track).toHaveBeenCalledWith('creator_opened', { kind: 'player', mode: 'create' });
    });

    it('switches frame with hair that fits, and offers only fitting cuts', async () => {
        await mountCreator();
        await openTab('Body');
        await click(button('Athletic F'));
        expect(person().appearance).toMatchObject({ frame: 'f', hair: { style: 'buzzedFemale' } });

        await openTab('Hair');
        const group = document.querySelector('[aria-labelledby="creator-hair-label"]')!;
        const labels = [...group.querySelectorAll('button')].map((b) => b.textContent?.trim());
        expect(labels).toEqual(['None', 'Buzzed', 'Long', 'Buns']);
    });

    it('updates the preview as soon as a hair style is picked', async () => {
        await mountCreator();
        await openTab('Hair');
        await click(button('Parted'));
        expect(person().appearance?.hair.style).toBe('parted');
    });

    it('sets skin from a swatch and from a full hex typed in', async () => {
        await mountCreator();
        await openTab('Body');
        await click(document.querySelector('[aria-label="Skin tone 3"]') as HTMLButtonElement);
        expect(person().appearance?.skin).toBe('#724a2f');

        await typeInto('input[aria-label="Skin hex"]', '#AABBCC');
        expect(person().appearance?.skin).toBe('#aabbcc');

        const input = await typeInto('input[aria-label="Skin hex"]', 'zz');
        expect(person().appearance?.skin).toBe('#aabbcc');
        expect(input.getAttribute('aria-invalid')).toBeNull();
    });

    it('applies a short hex only on blur', async () => {
        await mountCreator();
        await openTab('Body');
        const input = await typeInto('input[aria-label="Skin hex"]', '#abc');
        expect(person().appearance?.skin).toBe(DEFAULT_APPEARANCE.skin);
        await blur(input);
        expect(person().appearance?.skin).toBe('#aabbcc');
        expect(input.value).toBe('#aabbcc');
    });

    it('flags an unusable hex on blur and clears once fixed', async () => {
        await mountCreator();
        await openTab('Body');
        const input = await typeInto('input[aria-label="Skin hex"]', 'zz');
        await blur(input);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(document.body.textContent).toContain('Use #rrggbb');
        expect(person().appearance?.skin).toBe(DEFAULT_APPEARANCE.skin);

        await typeInto('input[aria-label="Skin hex"]', '#aabbcc');
        expect(hexInput('Skin').getAttribute('aria-invalid')).toBeNull();
        expect(person().appearance?.skin).toBe('#aabbcc');
    });

    it('moves a build slider by a tenth from the keyboard', async () => {
        await mountCreator();
        await openTab('Body');
        const thumb = document.querySelector('[role="slider"][aria-label="Girth"]') as HTMLElement;
        thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flushPromises();
        expect(person().appearance?.build.girth).toBe(0.1);
    });

    it('fills size and build from a preset, and shows Custom once a slider moves', async () => {
        await mountCreator();
        await openTab('Body');
        await click(startingWith('Guard'));
        const guard = BODY_PRESETS.m[0];
        expect(person()).toMatchObject({ heightInches: 75, weightPounds: 195 });
        expect(person().appearance?.build).toEqual(guard.build);
        expect(startingWith('Guard').getAttribute('aria-pressed') ?? startingWith('Guard').getAttribute('data-state')).toMatch(/true|on/);

        const thumb = document.querySelector('[role="slider"][aria-label="Shoulders"]') as HTMLElement;
        thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flushPromises();
        expect(startingWith('Custom').getAttribute('data-state')).toBe('on');
    });

    it('takes height from the profile fields', async () => {
        await mountCreator();
        await openTab('Body');
        await typeInto('#creator-height-feet', '7');
        expect(person().heightInches).toBe(7 * 12 + 6);
    });

    it("sets a jersey number, and refuses one that isn't 0-99 or 00", async () => {
        await mountCreator();
        await openTab('Gear');
        await typeInto('#creator-number', '00');
        expect(person().appearance?.jerseyNumber).toBe('00');
        expect(person().number).toBe('00');

        const input = await typeInto('#creator-number', '07');
        expect(person().appearance?.jerseyNumber).toBe('00');
        expect(input.getAttribute('aria-invalid')).toBe('true');

        await typeInto('#creator-number', '');
        expect(person().appearance?.jerseyNumber).toBeUndefined();
    });

    it('sets the pose', async () => {
        await mountCreator();
        await openTab('Pose');
        await click(button('Celebrate'));
        expect(person().appearance?.pose).toBe('celebrate');
    });

    it('ignores a click on the choice already selected', async () => {
        await mountCreator();
        await openTab('Body');
        await click(button('Athletic M'));
        expect(person().appearance?.frame).toBe('m');
        const before = person();
        await click(startingWith('Custom'));
        expect(person()).toEqual(before);

        await openTab('Pose');
        await click(button('Relaxed'));
        expect(person().appearance?.pose).toBe('relaxed');
    });

    it("doesn't rebuild the figure for a name, only relabels it", async () => {
        await mountCreator();
        const before = person();
        await typeInto('#creator-name', 'Nova');
        expect(person()).toBe(before);
        expect(latest().label).toContain('Nova');
    });

    it('saves the profile with the look', async () => {
        await mountCreator();
        await typeInto('#creator-name', '  Nova Reyes ');
        await openTab('Pose');
        await click(button('Hands on hips'));
        const data = await submitted();
        expect(data).toMatchObject({
            name: 'Nova Reyes',
            position: 'SG',
            heightFeet: 6,
            heightInches: 6,
            weightPounds: 200,
            overallRating: 75,
        });
        expect(data.appearance).toEqual({ ...DEFAULT_APPEARANCE, pose: 'handsOnHips' });
        // Counted by the dialog once the save goes through, not here.
        expect(mocks.track).not.toHaveBeenCalledWith('creator_saved', expect.anything());
    });

    it("opens a player's own look to edit, or the default when they have none", async () => {
        const look = { ...DEFAULT_APPEARANCE, frame: 'f' as const, hair: { style: 'long' as const, color: '#3b2a1e' } };
        await mountCreator(custom({ appearance: look }));
        expect(person().appearance).toEqual(look);
        expect(document.body.textContent).toContain('Edit player');
        wrapper!.unmount();
        wrapper = null;
        document.body.innerHTML = '';

        await mountCreator(custom());
        expect(person().appearance).toEqual(DEFAULT_APPEARANCE);
    });

    it("maps a stored cut that doesn't fit the frame, so the Hair tab shows it", async () => {
        await mountCreator(custom({ appearance: { ...DEFAULT_APPEARANCE, frame: 'f', hair: { style: 'parted', color: '#3b2a1e' } } }));
        expect(person().appearance?.hair.style).toBe('long');
        await openTab('Hair');
        expect(button('Long').getAttribute('data-state')).toBe('on');
    });

    it("keeps a stored 6'0\" and a 0 rating as they are", async () => {
        await mountCreator(custom({ heightInches: 0, overallRating: 0 }));
        expect(person().heightInches).toBe(72);
        const data = await submitted();
        expect(data).toMatchObject({ heightFeet: 6, heightInches: 0, overallRating: 0 });
    });

    it('still saves without WebGL', async () => {
        mocks.webgl = false;
        await mountCreator();
        expect(document.querySelector('[data-testid="unavailable-stub"]')).not.toBeNull();
        expect(mocks.renders).toEqual([]);
        await typeInto('#creator-name', 'Nova');
        expect((await submitted()).name).toBe('Nova');
    });

    it('disables Save without a name', async () => {
        await mountCreator();
        expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('names every tab, swatch group and slider', async () => {
        await mountCreator();
        expect([...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim())).toEqual([
            'Profile',
            'Body',
            'Face',
            'Hair',
            'Gear',
            'Pose',
        ]);
        expect(document.querySelector('[role="slider"]')?.getAttribute('aria-label')).toBe('Overall rating');
        await openTab('Body');
        for (const group of document.querySelectorAll('[role="radiogroup"]')) {
            const label = document.getElementById(group.getAttribute('aria-labelledby')!);
            expect(label?.textContent?.trim()).toBeTruthy();
        }
        for (const slider of document.querySelectorAll('[role="slider"]')) expect(slider.getAttribute('aria-label')).toBeTruthy();
    });
});
