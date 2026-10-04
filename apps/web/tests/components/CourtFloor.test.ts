import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CourtFloor from '@/components/court/CourtFloor.vue';
import type { CourtDesign } from '@/models/api';
import { courtTextColour, woodTones } from '@/utils/court';

const court = (overrides: Partial<CourtDesign> = {}): CourtDesign => ({
    version: 1,
    wood: 'maple',
    paint: '#4b2a7b',
    apron: '#4b2a7b',
    lines: '#ffffff',
    centerLogo: 'none',
    baselineText: 'Harbor Pavilion',
    sidelineText: 'Seattle',
    ...overrides,
});

const render = (design: CourtDesign, logoUrl?: string) => mount(CourtFloor, { props: { court: design, logoUrl } });

describe('CourtFloor', () => {
    it.each(['maple', 'honey', 'walnut', 'ash', 'ebony'] as const)('draws the %s floor from its own plank tones', (wood) => {
        const wrapper = render(court({ wood }));
        const fills = wrapper.findAll('[data-part="floor"] path').map((p) => p.attributes('fill'));
        expect(fills.length).toBeGreaterThan(1);
        for (const fill of fills) expect(woodTones(wood)).toContain(fill);
    });

    it('fills the keys and centre circle with the paint, or leaves them bare when unpainted', () => {
        const painted = render(court({ paint: '#0f6b3c' }));
        const paintFills = painted.findAll('[data-part="paint"]').map((el) => el.attributes('fill'));
        expect(paintFills).toHaveLength(3);
        expect(new Set(paintFills)).toEqual(new Set(['#0f6b3c']));

        const bare = render(court({ paint: null }));
        expect(new Set(bare.findAll('[data-part="paint"]').map((el) => el.attributes('fill')))).toEqual(new Set(['none']));
    });

    it('paints a solid apron, or stains the wood when the apron is null', () => {
        const solid = render(court({ apron: '#123456' }));
        expect(solid.find('[data-part="apron"]').attributes('fill')).toBe('#123456');
        expect(solid.find('[data-part="apron-planks"]').exists()).toBe(false);

        const stained = render(court({ apron: null }));
        expect(stained.find('[data-part="apron-planks"]').findAll('path').length).toBeGreaterThan(1);
    });

    it('draws every line in the line colour', () => {
        const wrapper = render(court({ lines: '#f2f2f2' }));
        const strokes = new Set(wrapper.findAll('[data-part="lines"] [stroke]').map((el) => el.attributes('stroke')));
        expect(strokes).toEqual(new Set(['#f2f2f2']));
    });

    it('puts the baseline text at both ends and the sideline text once, in the contrast colour', () => {
        const design = court({ apron: '#f5f5f5' });
        const wrapper = render(design);
        const baseline = wrapper.findAll('[data-part="baseline-text"]');
        expect(baseline.map((t) => t.text())).toEqual(['HARBOR PAVILION', 'HARBOR PAVILION']);
        expect(wrapper.find('[data-part="sideline-text"]').text()).toBe('SEATTLE');
        for (const text of [...baseline, wrapper.find('[data-part="sideline-text"]')]) {
            expect(text.attributes('fill')).toBe(courtTextColour(design));
        }
    });

    it('leaves out empty text and shrinks the longest text to fit', () => {
        const empty = render(court({ baselineText: '', sidelineText: '' }));
        expect(empty.find('[data-part="baseline-text"]').exists()).toBe(false);
        expect(empty.find('[data-part="sideline-text"]').exists()).toBe(false);

        const short = Number(render(court({ baselineText: 'Pit' })).find('[data-part="baseline-text"]').attributes('font-size'));
        const long = Number(render(court({ baselineText: 'W'.repeat(20) })).find('[data-part="baseline-text"]').attributes('font-size'));
        expect(long).toBeLessThan(short);
    });

    it('draws the centre logo only when given one, clipped to the circle', () => {
        expect(render(court({ centerLogo: 'none' })).find('image').exists()).toBe(false);

        const wrapper = render(court({ centerLogo: 'upload' }), 'https://cdn.example/arenas/a1/logo-1.png');
        const image = wrapper.find('image');
        expect(image.attributes('href')).toBe('https://cdn.example/arenas/a1/logo-1.png');
        const clip = image.attributes('clip-path');
        expect(clip).toMatch(/^url\(#.+\)$/);
        expect(wrapper.find(`clipPath${clip!.slice(4, -1)}`).exists()).toBe(true);
    });

    it('gives each court its own clip id, so two on a page do not share one', () => {
        const a = render(court(), 'https://cdn.example/a.png').find('image').attributes('clip-path');
        const b = render(court(), 'https://cdn.example/b.png').find('image').attributes('clip-path');
        expect(a).not.toBe(b);
    });

    it('adds nothing without a drawing, so a court without one looks as it did', () => {
        const plain = render(court({ centerLogo: 'upload' }), 'https://cdn.example/logo.png');
        expect(plain.find('[data-part="drawing"]').exists()).toBe(false);
        const empty = mount(CourtFloor, { props: { court: court(), drawingUrl: '' } });
        expect(empty.find('[data-part="drawing"]').exists()).toBe(false);
    });

    it('lays the drawing over the whole court, above the lines and below the text', () => {
        const wrapper = mount(CourtFloor, {
            props: { court: court(), drawingUrl: 'https://cdn.example/arenas/a1/drawing-1.png' },
        });
        const drawing = wrapper.get('image[data-part="drawing"]');
        expect(drawing.attributes()).toMatchObject({
            href: 'https://cdn.example/arenas/a1/drawing-1.png',
            x: '0',
            y: '0',
            width: '1040',
            height: '580',
            preserveAspectRatio: 'none',
        });

        const layers = [...wrapper.element.children].map(
            (el) => el.getAttribute('data-part') ?? el.tagName.toLowerCase(),
        );
        expect(layers.indexOf('drawing')).toBeGreaterThan(layers.indexOf('lines'));
        expect(layers.indexOf('drawing')).toBeLessThan(layers.indexOf('text'));
    });

    it('can draw just the floor or just the text, for the layers around a drawing canvas', () => {
        const props = { court: court({ centerLogo: 'upload' }), logoUrl: 'https://cdn.example/logo.png', drawingUrl: 'https://cdn.example/d.png' };

        const floor = mount(CourtFloor, { props: { ...props, part: 'floor' } });
        expect(floor.find('[data-part="lines"]').exists()).toBe(true);
        expect(floor.find('[data-part="baseline-text"]').exists()).toBe(false);
        expect(floor.find('[data-part="drawing"]').exists()).toBe(false);

        const text = mount(CourtFloor, { props: { ...props, part: 'text' } });
        expect(text.findAll('[data-part="baseline-text"]')).toHaveLength(2);
        expect(text.find('[data-part="sideline-text"]').exists()).toBe(true);
        for (const part of ['apron', 'floor', 'paint', 'lines', 'drawing']) {
            expect(text.find(`[data-part="${part}"]`).exists()).toBe(false);
        }
        expect(text.find('image').exists()).toBe(false);
    });

    it('is labelled for assistive tech unless decorative', () => {
        expect(render(court()).attributes('role')).toBe('img');
        const decorative = mount(CourtFloor, { props: { court: court(), decorative: true } });
        expect(decorative.attributes('aria-hidden')).toBe('true');
    });
});
