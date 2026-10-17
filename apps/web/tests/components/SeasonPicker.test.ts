import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SeasonPicker from '@/components/DailyEra/SeasonPicker.vue';

const mountPicker = (props: Record<string, unknown> = {}) =>
    mount(SeasonPicker, { props: { guessed: [], season: null, ...props } });

const decadeButton = (wrapper: ReturnType<typeof mountPicker>, label: string) =>
    wrapper.findAll('button').find((b) => b.text() === label)!;

const seasonButtons = (wrapper: ReturnType<typeof mountPicker>) =>
    wrapper.findAll('button').filter((b) => /^\d{4}-\d{2}$/.test(b.text()));

describe('SeasonPicker', () => {
    // Pinned so the decade count doesn't move with the real clock.
    beforeEach(() => vi.setSystemTime(new Date(2026, 9, 16)));
    afterEach(() => vi.useRealTimers());

    it('offers every decade and opens on the 1980s', () => {
        const wrapper = mountPicker();
        expect(wrapper.findAll('[aria-label="Decade"] button')).toHaveLength(9);
        expect(seasonButtons(wrapper)[0]!.text()).toBe('1980-81');
    });

    it("shows a decade's ten seasons and picks one", async () => {
        const wrapper = mountPicker();
        await decadeButton(wrapper, '1990s').trigger('click');
        const seasons = seasonButtons(wrapper);
        expect(seasons.map((b) => b.text())).toEqual([
            '1990-91', '1991-92', '1992-93', '1993-94', '1994-95',
            '1995-96', '1996-97', '1997-98', '1998-99', '1999-00',
        ]);
        await seasons.find((b) => b.text() === '1995-96')!.trigger('click');
        expect(wrapper.emitted('update:season')).toEqual([[1996]]);
    });

    it('marks the selected season', async () => {
        const wrapper = mountPicker({ season: 1996 });
        await decadeButton(wrapper, '1990s').trigger('click');
        const picked = seasonButtons(wrapper).find((b) => b.text() === '1995-96')!;
        const other = seasonButtons(wrapper).find((b) => b.text() === '1994-95')!;
        expect(picked.attributes('aria-pressed')).toBe('true');
        expect(picked.classes()).toContain('bg-primary');
        expect(other.attributes('aria-pressed')).toBe('false');
        expect(other.classes()).not.toContain('bg-primary');
    });

    it('disables a season already guessed and follows the latest guess', () => {
        const wrapper = mountPicker({
            guessed: [{ season: 1996, hit: false, direction: 'later', band: 'near' }],
        });
        const guessed = seasonButtons(wrapper).find((b) => b.text() === '1995-96')!;
        expect(guessed.attributes('disabled')).toBeDefined();
    });
});
