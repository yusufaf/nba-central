import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PlayByPlay from '@/components/BoxScore/PlayByPlay.vue';
import type { ESPNPlay } from '@/models/types';

const play = (id: string, text: string, type: string): ESPNPlay => ({
    id,
    sequenceNumber: id,
    type: { id: '1', text: type },
    text,
    period: { number: 1, displayValue: '1st Quarter' },
    clock: { displayValue: `${10 - Number(id)}:00` },
});

// One period, so the default-open accordion item shows every play.
const PLAYS = [
    play('1', 'Home One makes jump shot', 'Jump Shot'),
    play('2', 'Away One misses layup', 'Layup Shot'),
    play('3', 'Away Two bad pass', 'Bad Pass Turnover'),
];

// ESPN's 3-decimal WP: a real 5.0% drop that subtracts to just under 0.05.
const SWINGS = new Map([
    ['1', 0.06],
    ['2', 0.45 - 0.5],
    ['3', -0.049],
]);

const mountPlays = (wpByPlayId?: Map<string, number>) =>
    mount(PlayByPlay, { props: { plays: PLAYS, competitors: [], wpByPlayId }, attachTo: document.body });

const visibleTexts = (wrapper: ReturnType<typeof mountPlays>) =>
    wrapper.findAll('p.text-sm').map((p) => p.text());

const filter = (wrapper: ReturnType<typeof mountPlays>, label: RegExp) =>
    wrapper.findAll('button').find((b) => label.test(b.attributes('aria-label') ?? ''));

describe('PlayByPlay', () => {
    it('badges a play that swung 5% or more and not one that swung 4.9%', () => {
        const wrapper = mountPlays(SWINGS);
        const badges = wrapper.findAll('[data-testid="wp-badge"]').map((b) => b.text());
        expect(badges).toHaveLength(2);
        expect(badges.some((b) => b.startsWith('+6.0% WP'))).toBe(true);
        expect(badges.some((b) => b.startsWith('−5.0% WP'))).toBe(true);
        wrapper.unmount();
    });

    it('filters to big swings', async () => {
        const wrapper = mountPlays(SWINGS);
        await filter(wrapper, /big swings/i)!.trigger('click');
        expect(visibleTexts(wrapper)).toEqual(['Away One misses layup', 'Home One makes jump shot']);
        wrapper.unmount();
    });

    it('hides the Big swings filter without WP data', () => {
        const wrapper = mountPlays();
        expect(filter(wrapper, /big swings/i)).toBeUndefined();
        expect(wrapper.find('[data-testid="wp-badge"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('goes back to all plays when an update leaves no big swings', async () => {
        const wrapper = mountPlays(SWINGS);
        await filter(wrapper, /big swings/i)!.trigger('click');
        await wrapper.setProps({ wpByPlayId: new Map([['1', 0.01]]) });
        expect(filter(wrapper, /big swings/i)).toBeUndefined();
        expect(visibleTexts(wrapper)).toHaveLength(3);
        wrapper.unmount();
    });

    it('shows the filters on small screens', () => {
        const wrapper = mountPlays(SWINGS);
        const group = wrapper.get('[role="group"]');
        expect(group.classes()).not.toContain('hidden');
        wrapper.unmount();
    });

    it('still filters to shots', async () => {
        const wrapper = mountPlays(SWINGS);
        await filter(wrapper, /shots only/i)!.trigger('click');
        expect(visibleTexts(wrapper)).toEqual(['Away One misses layup']);
        wrapper.unmount();
    });
});
