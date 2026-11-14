import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { DEFAULT_APPEARANCE } from '@/utils/appearance';

const LOOK = { ...DEFAULT_APPEARANCE, frame: 'f' as const, hair: { style: 'long' as const, color: '#3b2a1e' } };

const mocks = vi.hoisted(() => ({
    createPlayer: vi.fn(),
    updatePlayer: vi.fn(),
    deletePlayer: vi.fn(),
    track: vi.fn(),
}));

vi.mock('@/composables/useCustomPlayers', () => ({
    useCustomPlayers: () => ({
        customPlayers: ref([
            {
                playerUUID: 'p1',
                name: 'Nova Reyes',
                position: 'PG',
                heightFeet: 6,
                heightInches: 3,
                weightPounds: 195,
                overallRating: 88,
                appearance: LOOK,
            },
        ]),
        createPlayer: mocks.createPlayer,
        updatePlayer: mocks.updatePlayer,
        deletePlayer: mocks.deletePlayer,
    }),
}));
vi.mock('@/lib/analytics', () => ({ track: mocks.track }));
vi.mock('@/network/api', () => ({ dataApi: { getPlayers: vi.fn(async () => ({ data: [] })) } }));
vi.mock('@/components/TeamBuilder/creator/CustomPlayerCreator.vue', () => ({
    default: defineComponent({
        name: 'CreatorStub',
        props: { open: Boolean, editingPlayer: { type: Object, default: null }, saving: Boolean },
        emits: ['submit', 'update:open'],
        setup: () => () => h('div'),
    }),
}));

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

import AddPlayerDialog from '@/components/TeamBuilder/AddPlayerDialog.vue';

const PAYLOAD = {
    name: 'Nova Reyes',
    position: 'PG',
    heightFeet: 6,
    heightInches: 4,
    weightPounds: 200,
    overallRating: 90,
    appearance: LOOK,
};

let wrapper: VueWrapper | null = null;
const mountDialog = async () => {
    wrapper = mount(AddPlayerDialog, {
        props: { open: true, selectedDrawerSide: 'right', 'onUpdate:open': () => {} },
        attachTo: document.body,
    });
    await flushPromises();
    return wrapper;
};
// Custom players are listed with the search results, so search first.
const searchFor = async (text: string) => {
    const input = document.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await flushPromises();
};
const creator = () => wrapper!.findComponent({ name: 'CreatorStub' });
const press = async (selector: string) => {
    (document.querySelector(selector) as HTMLButtonElement).click();
    await flushPromises();
};

beforeEach(() => {
    mocks.createPlayer.mockReset().mockResolvedValue({ playerUUID: 'new' });
    mocks.updatePlayer.mockReset().mockResolvedValue({ playerUUID: 'p1' });
    mocks.track.mockClear();
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
});

describe('AddPlayerDialog with the player creator', () => {
    it('creates a player with their look', async () => {
        await mountDialog();
        const create = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Create Custom Player'))!;
        create.click();
        await flushPromises();
        expect(creator().props('open')).toBe(true);
        expect(creator().props('editingPlayer')).toBeNull();

        creator().vm.$emit('submit', PAYLOAD);
        await flushPromises();
        expect(mocks.createPlayer).toHaveBeenCalledWith(PAYLOAD);
        expect(mocks.track).toHaveBeenCalledWith('creator_saved', { kind: 'player', mode: 'create', frame: 'f', hair: 'long', pose: 'relaxed' });
        expect(creator().props('open')).toBe(false);
        expect(wrapper!.emitted('customPlayerSaved')).toBeUndefined();
    });

    it('updates an edited player and reports their new look', async () => {
        await mountDialog();
        await searchFor('Nova');
        await press('button[aria-label="Edit Nova Reyes"]');
        expect(creator().props('editingPlayer')).toMatchObject({ playerUUID: 'p1' });

        creator().vm.$emit('submit', PAYLOAD);
        await flushPromises();
        expect(mocks.updatePlayer).toHaveBeenCalledWith('p1', PAYLOAD);
        expect(wrapper!.emitted('customPlayerSaved')).toEqual([[{ playerUUID: 'p1', appearance: LOOK }]]);
        expect(creator().props('open')).toBe(false);
    });

    it('reports nothing and stays open when the update fails', async () => {
        mocks.updatePlayer.mockResolvedValue(null);
        await mountDialog();
        await searchFor('Nova');
        await press('button[aria-label="Edit Nova Reyes"]');
        creator().vm.$emit('submit', PAYLOAD);
        await flushPromises();
        expect(wrapper!.emitted('customPlayerSaved')).toBeUndefined();
        expect(mocks.track).not.toHaveBeenCalledWith('creator_saved', expect.anything());
        expect(creator().props('open')).toBe(true);
        expect(creator().props('saving')).toBe(false);
    });

    it('names the edit and delete buttons', async () => {
        await mountDialog();
        await searchFor('Nova');
        expect(document.querySelector('button[aria-label="Edit Nova Reyes"]')).not.toBeNull();
        expect(document.querySelector('button[aria-label="Delete Nova Reyes"]')).not.toBeNull();
    });
});
