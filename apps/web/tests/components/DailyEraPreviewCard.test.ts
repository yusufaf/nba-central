import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DailyEraPreviewCard from '@/components/DailyEra/DailyEraPreviewCard.vue';

describe('DailyEraPreviewCard', () => {
    it('names the game and where to play it', () => {
        const text = mount(DailyEraPreviewCard).text();
        expect(text).toContain('Which Era?');
        expect(text).toContain('Guess the season this jersey was worn');
        expect(text).toContain('nba.yusufaf.dev/daily');
    });

    // The link preview is the same every day, so anything from a real puzzle
    // would give that day's answer away.
    it('shows no puzzle: no image, no puzzle number, no season', () => {
        const w = mount(DailyEraPreviewCard);
        expect(w.find('img').exists()).toBe(false);
        expect(w.text()).not.toContain('Daily #');
        expect(w.text()).not.toMatch(/\d{4}/);
    });

    it('draws one example tile per kind of guess', () => {
        expect(mount(DailyEraPreviewCard).findAll('[data-testid="preview-tile"]')).toHaveLength(4);
    });
});
