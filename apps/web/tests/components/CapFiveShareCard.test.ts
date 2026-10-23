import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CapFiveShareCard from '@/components/CapFive/CapFiveShareCard.vue';
import { candidates, result } from '../helpers/capFive';

describe('CapFiveShareCard', () => {
    it('shows the score, a tile per pick and the streak, and no names', () => {
        const w = mount(CapFiveShareCard, { props: { result: result(), streak: 3 } });
        expect(w.get('[data-testid="share-score"]').text()).toBe('412/415');
        expect(w.findAll('[data-testid="share-tile"]')).toHaveLength(5);
        expect(w.get('[data-testid="share-streak"]').text()).toBe('3');
        expect(w.text()).toContain('Daily #12');
        for (const c of candidates) expect(w.text()).not.toContain(c.name);
    });

    it('says bust and leaves an empty streak out', () => {
        const w = mount(CapFiveShareCard, { props: { result: result({ total: 431, busted: true }), streak: null } });
        expect(w.get('[data-testid="share-score"]').text()).toBe('431');
        expect(w.text()).toContain('Bust');
        expect(w.find('[data-testid="share-streak"]').exists()).toBe(false);
    });
});
