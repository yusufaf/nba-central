import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';

vi.mock('@/network/api', () => ({
    capFiveApi: { getPuzzle: vi.fn(), submit: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
// No html-to-image render from the share block.
vi.mock('@/components/CapFive/capFiveCard', () => ({
    renderCapFiveCard: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
}));

import { capFiveApi } from '@/network/api';
import CapFive from '@/views/CapFive.vue';
import { candidates, picks, puzzleView, result } from '../helpers/capFive';

const getPuzzle = vi.mocked(capFiveApi.getPuzzle);
const submitApi = vi.mocked(capFiveApi.submit);

let wrapper: VueWrapper | null = null;

const mountPage = async () => {
    wrapper = mount(CapFive, {
        global: { stubs: { PageShell: { template: '<div><slot /></div>' } } },
    });
    await flushPromises();
    return wrapper;
};

const candidateButton = (w: VueWrapper, name: string) => {
    const button = w.findAll('[data-testid="cap-five-candidate"]').find((b) => b.text().includes(name));
    if (!button) throw new Error(`No candidate "${name}"`);
    return button;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 2, 12) });
    localStorage.clear();
    getPuzzle.mockResolvedValue({ success: true, data: puzzleView });
    submitApi.mockResolvedValue({ success: true, data: result() });
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
});

describe('CapFive', () => {
    it('lets a signed-out visitor pick five, lock in and see their score against perfect', async () => {
        const w = await mountPage();
        expect(getPuzzle).toHaveBeenCalledWith('2026-11-02');
        expect(w.text()).toContain('Daily #12');
        // No rating before locking in.
        expect(w.find('[data-testid="rating-chip"]').exists()).toBe(false);
        expect(w.get('[data-testid="lock-in-button"]').text()).toBe('Pick 5 more');

        for (const id of picks) {
            await candidateButton(w, candidates.find((c) => c.id === id)!.name).trigger('click');
        }
        const lockIn = w.get('[data-testid="lock-in-button"]');
        expect(lockIn.text()).toBe('Lock in lineup');
        // Unpicked players can't be added once five are in.
        expect(candidateButton(w, 'Tim Duncan').attributes('disabled')).toBeDefined();

        await lockIn.trigger('click');
        await flushPromises();

        expect(submitApi).toHaveBeenCalledWith({ date: '2026-11-02', picks });
        expect(w.get('[data-testid="cap-five-score"]').text()).toContain('412 / 415');
        expect(w.get('[data-testid="cap-five-optimal"]').text()).toContain('Vince Carter');
        for (const testid of ['share-copy', 'share-download']) {
            expect(w.find(`[data-testid="${testid}"]`).exists()).toBe(true);
        }
        expect(w.findAll('[data-testid="rating-chip"]').length).toBeGreaterThan(0);
        expect(w.get('[data-testid="stat-streak"]').text()).toBe('1');
    });

    it('shows a stored result straight away on a reload', async () => {
        await mountPage();
        for (const id of picks) await candidateButton(wrapper!, candidates.find((c) => c.id === id)!.name).trigger('click');
        await wrapper!.get('[data-testid="lock-in-button"]').trigger('click');
        await flushPromises();
        wrapper!.unmount();
        getPuzzle.mockClear();

        const w = await mountPage();
        expect(getPuzzle).not.toHaveBeenCalled();
        expect(w.get('[data-testid="cap-five-score"]').text()).toContain('412 / 415');
    });

    it('says when there is no puzzle today', async () => {
        getPuzzle.mockRejectedValue(Object.assign(new Error('Gone'), { response: { status: 410 } }));
        expect((await mountPage()).text()).toContain('No puzzle today');
    });
});
