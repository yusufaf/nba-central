import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomePreviewCard from '@/components/Home/HomePreviewCard.vue';

describe('HomePreviewCard', () => {
    it('says what the site is and where it lives', () => {
        const text = mount(HomePreviewCard).text();
        expect(text).toContain('Build the');
        expect(text).toContain('GOAT');
        expect(text).toContain('team');
        expect(text).toContain('nba-central');
        expect(text).toContain('nba.yusufaf.dev');
    });

    it('colours the headline word like the home hero', () => {
        const word = mount(HomePreviewCard).get('[data-testid="headline-word"]');
        expect(word.text()).toBe('GOAT');
        expect(word.classes()).toContain('text-primary-strong');
    });

    // render:og loads the poster from the dev server's public/, so moving it
    // would ship a card with no photo.
    it("uses the home hero's poster, which ships from public/", () => {
        const img = mount(HomePreviewCard).get('img');
        expect(img.attributes('src')).toBe('/hero/hero-poster.jpg');
        expect(img.attributes('alt')).toBe('');
        expect(existsSync(resolve(__dirname, '../../public/hero/hero-poster.jpg'))).toBe(true);
    });
});
