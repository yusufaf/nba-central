import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CapFivePreviewCard from '@/components/CapFive/CapFivePreviewCard.vue';

describe('CapFivePreviewCard', () => {
    it('names the game and where to play it', () => {
        const text = mount(CapFivePreviewCard).text();
        expect(text).toContain('Cap Five');
        expect(text).toContain('Pick five. Stay under the cap.');
        expect(text).toContain('nba.yusufaf.dev/cap-five');
    });

    // The link preview is the same every day, so a player, a cap or a rating
    // could match, or give away, a real day's puzzle.
    it('shows no puzzle: no image, no names, no numbers', () => {
        const w = mount(CapFivePreviewCard);
        expect(w.find('img').exists()).toBe(false);
        expect(w.text()).not.toMatch(/\d/);
    });

    it('draws an empty five-man lineup and one example tile per pick', () => {
        const w = mount(CapFivePreviewCard);
        expect(w.findAll('[data-testid="preview-slot"]')).toHaveLength(5);
        expect(w.findAll('[data-testid="preview-tile"]')).toHaveLength(5);
    });
});
