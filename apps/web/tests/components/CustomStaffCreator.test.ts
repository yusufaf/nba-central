import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { StaffAppearance } from '@/constants/appearance';
import type { Coach, GM } from '@/models/types';
import type { PersonInput } from '@/three/character/person';
import { DEFAULT_STAFF_APPEARANCE } from '@/utils/appearance';

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

import CustomStaffCreator from '@/components/TeamBuilder/creator/CustomStaffCreator.vue';

const person = () => mocks.renders.at(-1)!.person;
const look = () => person().appearance as StaffAppearance;

let wrapper: VueWrapper | null = null;
const mountCreator = async (kind: 'coach' | 'gm', editing: Coach | GM | null = null) => {
    wrapper = mount(CustomStaffCreator, {
        props: { kind, open: true, editing, 'onUpdate:open': () => {} },
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
    return (wrapper!.emitted('submit') as unknown[][] | undefined)?.at(-1)?.[0] as Record<string, unknown> & {
        appearance: StaffAppearance;
    };
};

const STORED: StaffAppearance = {
    ...structuredClone(DEFAULT_STAFF_APPEARANCE),
    hair: { style: 'buzzed', color: '#1b1512' },
    outfit: { style: 'polo', primary: '#00471b', secondary: '#eee1c6' },
    ageLook: 'veteran',
    build: { girth: 0.2, shoulders: 0, wingspan: 0, heightIn: 70 },
};
const coach = (extra: Partial<Coach> = {}) =>
    ({ name: 'Coach Vega', isCustom: true, coachUUID: 'c1', overallRating: 81, specialty: 'Defensive', ...extra }) as Coach;

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

describe('CustomStaffCreator', () => {
    it('has the six staff tabs', async () => {
        await mountCreator('coach');
        const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
        expect(tabs).toEqual(['Profile', 'Body', 'Face', 'Hair', 'Outfit', 'Pose']);
    });

    it("shows a coach's rating and specialty, and a GM's team picker", async () => {
        await mountCreator('coach');
        expect(document.querySelector('[role="slider"]')).not.toBeNull();
        expect(document.getElementById('creator-specialty-label')).not.toBeNull();
        expect(document.querySelector('[aria-label="Add a team"]')).toBeNull();
        wrapper!.unmount();
        document.body.innerHTML = '';

        await mountCreator('gm');
        expect(document.querySelector('[aria-label="Add a team"]')).not.toBeNull();
        expect(document.querySelector('[role="slider"]')).toBeNull();
    });

    it('seeds a new coach, and a coach saved before looks, with the default look', async () => {
        await mountCreator('coach');
        expect(look()).toEqual(DEFAULT_STAFF_APPEARANCE);
        wrapper!.unmount();
        document.body.innerHTML = '';

        await mountCreator('coach', coach());
        expect(look()).toEqual(DEFAULT_STAFF_APPEARANCE);
        expect((document.getElementById('creator-name') as HTMLInputElement).value).toBe('Coach Vega');
    });

    it("seeds an edited coach's own look and height", async () => {
        await mountCreator('coach', coach({ appearance: STORED }));
        expect(look()).toEqual(STORED);
        expect(person().heightInches).toBe(70);
        await openTab('Body');
        expect((document.getElementById('creator-height-feet') as HTMLInputElement).value).toBe('5');
        expect((document.getElementById('creator-height-inches') as HTMLInputElement).value).toBe('10');
    });

    it('changes the outfit in the preview', async () => {
        await mountCreator('coach');
        await openTab('Outfit');
        await click(button('Tracksuit')!);
        expect(look().outfit.style).toBe('tracksuit');
    });

    it('sets the age look', async () => {
        await mountCreator('coach');
        await openTab('Body');
        await click(button('Veteran')!);
        expect(look().ageLook).toBe('veteran');
    });

    it('stands the preview at the typed height', async () => {
        await mountCreator('gm');
        await openTab('Body');
        await typeInto('#creator-height-feet', '6');
        await typeInto('#creator-height-inches', '8');
        expect(person().heightInches).toBe(80);
        expect(look().build.heightIn).toBe(80);
    });

    it('offers only glasses', async () => {
        await mountCreator('coach');
        await openTab('Outfit');
        expect(button('Glasses')).toBeDefined();
        for (const label of ['Headband', 'Arm sleeve', 'Goggles']) expect(button(label)).toBeUndefined();
        expect(document.body.textContent).not.toContain("Goggles and glasses don't go together.");
    });

    it("submits a coach's fields and a plain look", async () => {
        await mountCreator('coach', coach({ appearance: STORED }));
        await openTab('Outfit');
        await click(button('Glasses')!);
        const data = await submitted();
        expect(data).toEqual({
            name: 'Coach Vega',
            overallRating: 81,
            specialty: 'Defensive',
            appearance: { ...STORED, accessories: [{ id: 'glasses', color: expect.any(String) }] },
        });
        expect(Object.getPrototypeOf(data.appearance)).toBe(Object.prototype);
    });

    it("submits a GM's teams", async () => {
        await mountCreator('gm', { name: 'Exec Ortiz', teams: ['SEA'], isCustom: true, gmUUID: 'g1' } as GM);
        const data = await submitted();
        expect(data).toMatchObject({ name: 'Exec Ortiz', teams: ['SEA'] });
        expect(data).not.toHaveProperty('specialty');
        expect(data.appearance.outfit).toEqual(DEFAULT_STAFF_APPEARANCE.outfit);
    });

    it('holds Save for a blank name or an out-of-range height', async () => {
        await mountCreator('coach');
        expect(submitButton().disabled).toBe(true);
        await typeInto('#creator-name', 'Coach Vega');
        expect(submitButton().disabled).toBe(false);

        await openTab('Body');
        await typeInto('#creator-height-feet', '4');
        await typeInto('#creator-height-inches', '11');
        expect(submitButton().disabled).toBe(true);
        // The preview keeps the last height in range.
        expect(person().heightInches).toBe(74);
    });

    it('shows the no-WebGL notice instead of a preview', async () => {
        mocks.webgl = false;
        await mountCreator('coach');
        expect(document.querySelector('[data-testid="unavailable-stub"]')).not.toBeNull();
        expect(document.querySelector('[data-testid="preview-stub"]')).toBeNull();
    });
});
