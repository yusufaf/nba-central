import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { TeamUniform } from '@/models/api';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('@/utils/jerseyColours', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils/jerseyColours')>()),
    loadJerseyColours: mocks.load,
}));

import UniformColourFields from '@/components/TeamBuilder/UniformColourFields.vue';

const SAMPLED: TeamUniform = { primary: '#112233', secondary: '#445566', trim: '#ffffff' };

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

let wrapper: VueWrapper | undefined;

const mountFields = (props: { uniform?: TeamUniform | null; jerseyUrl?: string } = {}) => {
    wrapper = mount(UniformColourFields, {
        props: { uniform: null, jerseyUrl: 'https://cdn/jersey.png', ...props },
        attachTo: document.body,
    });
    return wrapper;
};

const swatch = (w: VueWrapper, label: string) => w.find<HTMLButtonElement>(`button[aria-label="${label} colour"]`);
const resetButton = (w: VueWrapper) => w.findAll('button').find((b) => b.text() === 'Use jersey colours')!;
const picker = (w: VueWrapper, index: number) => w.findAllComponents({ name: 'ColorPicker' })[index];

beforeEach(() => {
    mocks.load.mockReset().mockResolvedValue(SAMPLED);
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = '';
});

describe('UniformColourFields', () => {
    it('shows the sampled colours when not overridden', async () => {
        const w = mountFields();
        await flushPromises();
        expect(mocks.load).toHaveBeenCalledWith('https://cdn/jersey.png');
        expect(swatch(w, 'Primary').attributes('style')).toContain('rgb(17, 34, 51)');
        expect(swatch(w, 'Trim').attributes('style')).toContain('rgb(255, 255, 255)');
    });

    it('editing one colour emits all three with that one changed', async () => {
        const w = mountFields();
        await flushPromises();
        picker(w, 1).vm.$emit('update:modelValue', '#AA0000');
        expect(w.emitted('update:uniform')?.at(-1)).toEqual([{ ...SAMPLED, secondary: '#aa0000' }]);
    });

    it('builds on the override once there is one', async () => {
        const uniform = { primary: '#010101', secondary: '#020202', trim: '#030303' };
        const w = mountFields({ uniform });
        await flushPromises();
        picker(w, 0).vm.$emit('update:modelValue', '#aa0000');
        expect(w.emitted('update:uniform')?.at(-1)).toEqual([{ ...uniform, primary: '#aa0000' }]);
    });

    it('ignores a value that is not a colour', async () => {
        const w = mountFields();
        await flushPromises();
        picker(w, 0).vm.$emit('update:modelValue', 'nope');
        expect(w.emitted('update:uniform')).toBeUndefined();
    });

    it('Use jersey colours emits null and is disabled without an override', async () => {
        const w = mountFields();
        await flushPromises();
        expect(resetButton(w).attributes('disabled')).toBeDefined();

        await w.setProps({ uniform: { primary: '#010101', secondary: '#020202', trim: '#030303' } });
        expect(resetButton(w).attributes('disabled')).toBeUndefined();
        await resetButton(w).trigger('click');
        expect(w.emitted('update:uniform')?.at(-1)).toEqual([null]);
    });

    it('pickers are disabled until the jersey is sampled', async () => {
        const pending = deferred<TeamUniform>();
        mocks.load.mockReturnValueOnce(pending.promise);
        const w = mountFields();
        await flushPromises();
        expect(swatch(w, 'Primary').attributes('disabled')).toBeDefined();

        pending.resolve(SAMPLED);
        await flushPromises();
        expect(swatch(w, 'Primary').attributes('disabled')).toBeUndefined();
    });

    it('re-sampling a new jersey keeps the previous colours and the pickers enabled', async () => {
        const w = mountFields();
        await flushPromises();
        const pending = deferred<TeamUniform>();
        mocks.load.mockReturnValueOnce(pending.promise);
        await w.setProps({ jerseyUrl: 'data:image/png;base64,stroke' });
        await flushPromises();
        expect(swatch(w, 'Primary').attributes('disabled')).toBeUndefined();
        expect(swatch(w, 'Primary').attributes('style')).toContain('rgb(17, 34, 51)');

        pending.resolve({ primary: '#aa0000', secondary: '#ffffff', trim: '#000000' });
        await flushPromises();
        expect(swatch(w, 'Primary').attributes('style')).toContain('rgb(170, 0, 0)');
    });

    it('a newer jersey wins over a slower earlier sample', async () => {
        const slow = deferred<TeamUniform>();
        mocks.load.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ primary: '#aa0000', secondary: '#ffffff', trim: '#000000' });
        const w = mountFields();
        await w.setProps({ jerseyUrl: 'https://cdn/newer.png' });
        await flushPromises();
        slow.resolve(SAMPLED);
        await flushPromises();
        expect(swatch(w, 'Primary').attributes('style')).toContain('rgb(170, 0, 0)');
    });
});
