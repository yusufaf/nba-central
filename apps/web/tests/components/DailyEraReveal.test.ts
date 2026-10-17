import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { nextTick } from 'vue';

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import { track } from '@/lib/analytics';
import DailyEraReveal from '@/components/DailyEra/DailyEraReveal.vue';
import historicalJerseysData from '@/assets/data/historicalJerseys.json';
import type { HistoricalJersey } from '@/models/types';
import { mediaIdFromJerseyUrl } from '@/utils/historicalJersey';

const row = (historicalJerseysData as HistoricalJersey[]).find((r) => r.slot === 'home-road')!;
const mediaId = mediaIdFromJerseyUrl(row.jersey)!;

const answerFor = (id: string) => ({
    runLabel: '1995-96 – 1998-99',
    teamName: 'Vancouver Grizzlies',
    franchise: 'MEM',
    shownIdentity: { franchise: 'MEM', name: row.name, startYear: 1996, mediaId: id },
});

const mountReveal = (props: Record<string, unknown> = {}) =>
    mount(DailyEraReveal, {
        props: {
            answer: answerFor(mediaId),
            solved: true,
            attempts: 2,
            fallbackImageUrl: 'https://cdn/puzzle.webp',
            puzzleNumber: 32,
            date: '2026-11-06',
            ...props,
        },
        global: { stubs: { RouterLink: RouterLinkStub } },
    });

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 12));
});
afterEach(() => vi.useRealTimers());

describe('DailyEraReveal', () => {
    it('shows the run, the full jersey and a builder link that preselects it', async () => {
        const wrapper = mountReveal();
        expect(wrapper.text()).toContain('Got it in 2/4');
        expect(wrapper.text()).toContain('1995-96 – 1998-99');
        expect(wrapper.text()).toContain('Vancouver Grizzlies');
        expect(wrapper.find('img').attributes('src')).toBe(row.jersey);
        const link = wrapper.findComponent(RouterLinkStub);
        expect(link.props('to')).toEqual({ path: '/teambuilder', query: { jersey: mediaId } });

        await link.trigger('click');
        expect(track).toHaveBeenCalledWith('daily_era_builder_clicked', { puzzleNumber: 32 });
    });

    it('falls back to the puzzle image and drops the link for an unknown jersey', () => {
        const wrapper = mountReveal({ answer: answerFor('unknown'), solved: false });
        expect(wrapper.text()).toContain('Out of guesses');
        expect(wrapper.find('img').attributes('src')).toBe('https://cdn/puzzle.webp');
        expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false);
    });

    it('announces the result but not the ticking countdown', () => {
        const wrapper = mountReveal();
        const live = wrapper.findAll('[aria-live]');
        expect(live).toHaveLength(1);
        expect(live[0]!.text()).toContain('Got it in 2/4');
        expect(live[0]!.text()).not.toContain('Next puzzle in');
    });

    it('credits the Basketball Jersey Database', () => {
        expect(mountReveal().find('a[href="https://www.bballjerseys.com"]').exists()).toBe(true);
    });

    it('counts down to midnight, then offers the next puzzle', async () => {
        vi.setSystemTime(new Date(2026, 10, 6, 23, 59, 58));
        const wrapper = mountReveal();
        expect(wrapper.text()).toContain('0:00:02');

        vi.advanceTimersByTime(3000);
        await nextTick();
        const next = wrapper.findAll('button').find((b) => b.text() === "Play today's puzzle");
        expect(next).toBeDefined();
        await next!.trigger('click');
        expect(wrapper.emitted('next')).toHaveLength(1);
    });

    it('offers the next puzzle straight away for a game finished after midnight', () => {
        vi.setSystemTime(new Date(2026, 10, 7, 0, 5));
        const wrapper = mountReveal();
        expect(wrapper.text()).toContain("Play today's puzzle");
        expect(wrapper.text()).not.toContain('Next puzzle in');
    });
});
