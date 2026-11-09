import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import RosterNumberFields from '@/components/TeamBuilder/RosterNumberFields.vue';
import type { RosterNumbers, RosterRow } from '@/utils/rosterNumbers';

const ROSTER: RosterRow[] = [
    { slot: 1, label: 'PG', name: 'Gary Payton' },
    { slot: 5, label: 'C', name: 'Shawn Kemp' },
    { slot: 6, label: 'Bench', name: 'Detlef Schrempf' },
];

let wrapper: VueWrapper | undefined;

const mountFields = (numbers: RosterNumbers = {}, roster = ROSTER) => {
    wrapper = mount(RosterNumberFields, {
        props: {
            roster,
            numbers,
            'onUpdate:numbers': (next: RosterNumbers) => wrapper!.setProps({ numbers: next }),
        },
    });
    return wrapper;
};

const input = (w: VueWrapper, slot: number) => w.find<HTMLInputElement>(`input[data-slot="${slot}"]`);
const type = async (w: VueWrapper, slot: number, value: string) => {
    const field = input(w, slot);
    field.element.value = value;
    await field.trigger('input');
};
const lastNumbers = (w: VueWrapper) => w.emitted<[RosterNumbers]>('update:numbers')?.at(-1)?.[0];

afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
});

describe('RosterNumberFields', () => {
    it('lists rostered players in the order given, with their numbers', () => {
        const w = mountFields({ 5: '40' });
        expect(w.findAll('label').map((label) => label.text())).toEqual([
            'PG · Gary Payton',
            'C · Shawn Kemp',
            'Bench · Detlef Schrempf',
        ]);
        expect(input(w, 5).element.value).toBe('40');
        expect(input(w, 1).element.value).toBe('');
    });

    it('typing 23 emits that slot\'s number', async () => {
        const w = mountFields();
        await type(w, 1, '2');
        await type(w, 1, '23');
        expect(lastNumbers(w)).toEqual({ 1: '23' });
    });

    it('accepts 00 and 0', async () => {
        const w = mountFields();
        await type(w, 1, '00');
        expect(lastNumbers(w)).toEqual({ 1: '00' });
        await type(w, 5, '0');
        expect(lastNumbers(w)).toEqual({ 1: '00', 5: '0' });
    });

    it('clearing emits without the slot', async () => {
        const w = mountFields({ 1: '23', 5: '40' });
        await type(w, 1, '');
        expect(lastNumbers(w)).toEqual({ 5: '40' });
    });

    it('drops a leading zero, so 0 then 7 saves 7 and what shows is what saves', async () => {
        const w = mountFields();
        await type(w, 1, '0');
        expect(lastNumbers(w)).toEqual({ 1: '0' });
        await type(w, 1, '07');
        expect(input(w, 1).element.value).toBe('7');
        expect(lastNumbers(w)).toEqual({ 1: '7' });
    });

    it('a pasted 070 keeps both digits after the zero', async () => {
        const w = mountFields({ 1: '7' });
        await type(w, 1, '070');
        expect(input(w, 1).element.value).toBe('70');
        expect(lastNumbers(w)).toEqual({ 1: '70' });
    });

    it('points every field at the format hint', () => {
        const w = mountFields();
        const hint = w.find('[data-testid="number-hint"]');
        expect(hint.text()).toContain('0 to 99, or 00');
        expect(input(w, 1).attributes('aria-describedby')).toBe(hint.attributes('id'));
    });

    it('strips letters and keeps at most two digits', async () => {
        const w = mountFields();
        await type(w, 1, '2a');
        expect(input(w, 1).element.value).toBe('2');
        await type(w, 1, '234');
        expect(input(w, 1).element.value).toBe('23');
        expect(lastNumbers(w)).toEqual({ 1: '23' });
    });

    it('strips a letter typed after an existing number', async () => {
        const w = mountFields({ 1: '23' });
        await type(w, 1, '23a');
        expect(input(w, 1).element.value).toBe('23');
        expect(w.emitted('update:numbers')).toBeUndefined();
    });

    it('shows a hint for an empty roster', () => {
        const w = mountFields({}, []);
        expect(w.findAll('input')).toHaveLength(0);
        expect(w.find('[data-testid="number-hint"]').exists()).toBe(false);
        expect(w.text()).toContain('Add players to give them numbers.');
    });
});
