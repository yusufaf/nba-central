import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DailyEraShareCard from '@/components/DailyEra/DailyEraShareCard.vue';
import { dailyEraShareResult } from '@/utils/dailyEraShare';
import { far, hit, near, secretsOf, solvedGame } from '../helpers/dailyEraShare';

const CROP = 'data:image/webp;base64,UklGRg==';
const lost = [far(1960, 'later'), near(1980, 'later'), near(2000, 'earlier'), far(2020, 'earlier')];

const mountCard = (result = dailyEraShareResult(solvedGame, 5), imageUrl: string | null = CROP) =>
    mount(DailyEraShareCard, { props: { result, imageUrl } });

describe('DailyEraShareCard', () => {
    it('shows the score, the streak, a tile per guess and the art credit', () => {
        const w = mountCard();
        expect(w.get('[data-testid="share-score"]').text()).toBe('3/4');
        expect(w.findAll('[data-testid="share-tile"]')).toHaveLength(3);
        expect(w.get('[data-testid="share-streak"]').text()).toBe('5');
        expect(w.text()).toContain('Daily #12');
        expect(w.text()).toContain('Jersey art: Basketball Jersey Database');
        expect(w.get('img').attributes('src')).toBe(CROP);
    });

    it('shows X for a loss and no streak when there is none', () => {
        const w = mountCard(dailyEraShareResult({ puzzleNumber: 4, guesses: lost }, null));
        expect(w.get('[data-testid="share-score"]').text()).toBe('X/4');
        expect(w.find('[data-testid="share-streak"]').exists()).toBe(false);
        expect(w.findAll('[data-testid="share-tile"]')).toHaveLength(4);
    });

    it('draws a plain box when the crop could not be fetched', () => {
        const w = mountCard(dailyEraShareResult({ puzzleNumber: 1, guesses: [hit(1990)] }, null), null);
        expect(w.find('img').exists()).toBe(false);
        expect(w.find('[data-testid="share-card-image-fallback"]').exists()).toBe(true);
    });

    it('never includes the answer or a guessed season', () => {
        const html = mountCard(dailyEraShareResult(solvedGame, 3)).html();
        for (const secret of secretsOf(solvedGame)) expect(html).not.toContain(secret);
    });
});
