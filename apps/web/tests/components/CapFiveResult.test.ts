import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import CapFiveResult from '@/components/CapFive/CapFiveResult.vue';
import { track } from '@/lib/analytics';
import { result } from '../helpers/capFive';
import type { CapFiveResult as Result } from '@/models/api';

let wrapper: VueWrapper | null = null;

const mountResult = (props: Result) => {
    wrapper = mount(CapFiveResult, {
        props: { result: props },
        global: { stubs: { RouterLink: RouterLinkStub } },
    });
    return wrapper;
};

const link = (testid: string) =>
    wrapper!.findAllComponents(RouterLinkStub).find((l) => l.attributes('data-testid') === testid);

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 2, 12) });
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
});

describe('CapFiveResult builder links', () => {
    it('links your five and the perfect five into the builder', async () => {
        mountResult(result());
        expect(link('builder-link-picks')!.props('to')).toEqual({
            path: '/teambuilder',
            query: { players: 'c04,c01,c07,c02,c06' },
        });
        expect(link('builder-link-perfect')!.props('to')).toEqual({
            path: '/teambuilder',
            query: { players: 'c04,c01,c03,c10,c12' },
        });

        await link('builder-link-picks')!.trigger('click');
        expect(track).toHaveBeenCalledWith('cap_five_builder_clicked', { puzzleNumber: 12, lineup: 'picks' });
        await link('builder-link-perfect')!.trigger('click');
        expect(track).toHaveBeenCalledWith('cap_five_builder_clicked', { puzzleNumber: 12, lineup: 'perfect' });
    });

    it('offers only your five when it is the perfect one', () => {
        mountResult(result({ picks: ['c12', 'c10', 'c03', 'c01', 'c04'], total: 415 }));
        expect(link('builder-link-picks')).toBeDefined();
        expect(link('builder-link-perfect')).toBeUndefined();
    });

    it('still offers a busted lineup', () => {
        mountResult(result({ busted: true, total: 430 }));
        expect(link('builder-link-picks')).toBeDefined();
    });
});
