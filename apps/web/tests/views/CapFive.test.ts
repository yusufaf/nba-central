import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub, type VueWrapper } from '@vue/test-utils';

vi.mock('@/network/api', () => ({
    capFiveApi: { getPuzzle: vi.fn(), submit: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
// No html-to-image render from the share block.
vi.mock('@/components/CapFive/capFiveCard', () => ({
    renderCapFiveCard: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
}));

import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { capFiveApi } from '@/network/api';
import CapFive from '@/views/CapFive.vue';
import { capFivePuzzleNumber, readCapFiveGames, writeCapFiveGame, type StoredCapFiveGame } from '@/utils/capFive';
import { candidates, picks, puzzleView, result } from '../helpers/capFive';

const getPuzzle = vi.mocked(capFiveApi.getPuzzle);
const submitApi = vi.mocked(capFiveApi.submit);
const gone = Object.assign(new Error('Gone'), { response: { status: 410 } });

let wrapper: VueWrapper | null = null;
let router: Router;

const mountPage = async (path = '/cap-five') => {
    router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/cap-five', name: 'capFive', component: CapFive },
            { path: '/teambuilder', component: { template: '<div />' } },
        ],
    });
    await router.push(path);
    await router.isReady();
    wrapper = mount(CapFive, {
        global: {
            plugins: [router],
            stubs: { PageShell: { template: '<div><slot /></div>' }, RouterLink: RouterLinkStub },
        },
    });
    await flushPromises();
    return wrapper;
};

const puzzleFor = (day: string) => ({ ...puzzleView, date: day, puzzleNumber: capFivePuzzleNumber(day) });

const seed = (day: string, over: Partial<StoredCapFiveGame['result']> = {}, archive = false) =>
    writeCapFiveGame(day, { result: result({ date: day, puzzleNumber: capFivePuzzleNumber(day), ...over }), archive });

const archiveLinks = (w: VueWrapper) =>
    w.findAllComponents(RouterLinkStub).filter((l) => l.attributes('data-testid') === 'archive-day');
const todayLink = (w: VueWrapper) => w.find('[data-testid="today-link"]');

const candidateButton = (w: VueWrapper, name: string) => {
    const button = w.findAll('[data-testid="cap-five-candidate"]').find((b) => b.text().includes(name));
    if (!button) throw new Error(`No candidate "${name}"`);
    return button;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 2, 12) });
    localStorage.clear();
    getPuzzle.mockImplementation(async (day) => ({ success: true, data: puzzleFor(day) }));
    submitApi.mockImplementation(async ({ date }) => ({
        success: true,
        data: result({ date, puzzleNumber: capFivePuzzleNumber(date) }),
    }));
});

afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const lockIn = async (w: VueWrapper) => {
    for (const id of picks) await candidateButton(w, candidates.find((c) => c.id === id)!.name).trigger('click');
    await w.get('[data-testid="lock-in-button"]').trigger('click');
    await flushPromises();
};

const clickText = async (w: VueWrapper, text: string) => {
    const button = w.findAll('button').find((b) => b.text() === text);
    if (!button) throw new Error(`No button "${text}"`);
    await button.trigger('click');
    await flushPromises();
};

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

    it("shows only real positions, and a non-current rating as Classic", async () => {
        // A day frozen before apps/cdk filtered 2K's placeholder positions.
        const [first, ...rest] = puzzleView.candidates;
        getPuzzle.mockResolvedValue({
            success: true,
            data: { ...puzzleView, candidates: [{ ...first, positions: ['PF', 'N'] }, ...rest] },
        });
        const w = await mountPage();
        const allen = candidateButton(w, 'Ray Allen');
        expect(allen.findAll('.flex-wrap > *').map((b) => b.text())).toEqual(['PF', 'Classic']);
        expect(candidateButton(w, 'Stephen Curry').text()).toContain('Current');
        expect(w.text()).not.toContain('Legend');
    });

    it('names each pick in the lineup, in full as a row and short as a column', async () => {
        const w = await mountPage();
        await candidateButton(w, 'Dikembe Mutombo').trigger('click');
        const slot = w.findAll('[data-testid="cap-five-slot"]')[0];
        expect(slot.attributes('title')).toBe('Dikembe Mutombo');
        expect(slot.findAll('span').map((s) => s.text())).toEqual(['Dikembe Mutombo', 'D. Mutombo']);
    });

    it('keeps full names in the lineup when two picks would share a short one', async () => {
        getPuzzle.mockResolvedValue({
            success: true,
            data: {
                ...puzzleView,
                candidates: puzzleView.candidates.map((c) => (c.id === 'c08' ? { ...c, name: 'Kevin Lowry' } : c)),
            },
        });
        const w = await mountPage();
        for (const name of ['Kyle Lowry', 'Kevin Lowry', 'Tim Duncan']) await candidateButton(w, name).trigger('click');
        const shorts = w.findAll('[data-testid="cap-five-slot"]').slice(0, 3).map((s) => s.findAll('span')[1].text());
        expect(shorts).toEqual(['Kyle Lowry', 'Kevin Lowry', 'T. Duncan']);
    });

    it('says when there is no puzzle today', async () => {
        getPuzzle.mockRejectedValue(Object.assign(new Error('Gone'), { response: { status: 410 } }));
        expect((await mountPage()).text()).toContain('No puzzle today');
    });
});

describe('CapFive archive', () => {
    it('lists the days before today with their results', async () => {
        seed('2026-11-01', { total: 415 });
        seed('2026-10-31', { busted: true, total: 431 });
        seed('2026-10-30');
        const links = archiveLinks(await mountPage());
        expect(links).toHaveLength(11);
        expect(links[0].props('to')).toEqual({ name: 'capFive', query: { date: '2026-11-01' } });
        expect(links.at(-1)!.props('to')).toEqual({ name: 'capFive', query: { date: '2026-10-22' } });
        expect(links[0].text()).toContain('#11');
        expect(links.at(-1)!.text()).toContain('#1');
        expect(links.slice(0, 4).map((l) => l.findAll('span').at(-1)!.text())).toEqual([
            'Perfect',
            'Bust',
            '412/415',
            'Play',
        ]);
    });

    it('lists 30 days once the window is full', async () => {
        vi.setSystemTime(new Date(2026, 10, 26, 12));
        const links = archiveLinks(await mountPage());
        expect(links).toHaveLength(30);
        expect(links[0].props('to')).toEqual({ name: 'capFive', query: { date: '2026-11-25' } });
        expect(links.at(-1)!.props('to')).toEqual({ name: 'capFive', query: { date: '2026-10-27' } });
    });

    it('plays an archive date from the query', async () => {
        const w = await mountPage('/cap-five?date=2026-11-01');
        expect(getPuzzle).toHaveBeenCalledWith('2026-11-01');
        // Scoped to the header: the archive's first row carries the same date label.
        const header = w.get('header').text();
        expect(header).toContain('Daily #11');
        expect(header).toContain('Nov 1, 2026');
        expect(todayLink(w).exists()).toBe(true);

        await lockIn(w);
        expect(submitApi).toHaveBeenCalledWith({ date: '2026-11-01', picks });
        expect(readCapFiveGames()['2026-11-01'].archive).toBe(true);
        expect(w.get('[data-testid="stat-streak"]').text()).toBe('0');
        expect(w.get('section[aria-labelledby="cap-five-stats-heading"]').text()).toContain(
            "doesn't count toward your streak",
        );

        await clickText(w, "Play today's puzzle");
        expect(router.currentRoute.value.query.date).toBeUndefined();
        expect(getPuzzle).toHaveBeenLastCalledWith('2026-11-02');
    });

    it("links back to today's puzzle mid-game", async () => {
        const w = await mountPage('/cap-five?date=2026-11-01');
        const link = w.findAllComponents(RouterLinkStub).find((l) => l.attributes('data-testid') === 'today-link');
        expect(link?.props('to')).toEqual({ name: 'capFive' });
        wrapper!.unmount();
        expect(todayLink(await mountPage()).exists()).toBe(false);
    });

    it('shows the stored result of a played archive date', async () => {
        seed('2026-10-30', {}, true);
        const w = await mountPage('/cap-five?date=2026-10-30');
        expect(getPuzzle).not.toHaveBeenCalled();
        expect(w.get('[data-testid="cap-five-score"]').text()).toContain('412 / 415');
        expect(w.find('[data-testid="lock-in-button"]').exists()).toBe(false);
    });

    it('says an earlier day is no longer playable', async () => {
        getPuzzle.mockRejectedValueOnce(gone);
        const w = await mountPage('/cap-five?date=2026-09-01');
        expect(w.text()).toContain('This puzzle is no longer playable.');
        await clickText(w, "Play today's puzzle");
        expect(router.currentRoute.value.query.date).toBeUndefined();
        expect(getPuzzle).toHaveBeenLastCalledWith('2026-11-02');
    });

    it.each(['junk', '2026-11-02', '2026-11-03', '2026-02-30'])('rewrites %s to today', async (date) => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        await mountPage(`/cap-five?date=${date}`);
        expect(router.currentRoute.value.query.date).toBeUndefined();
        expect(getPuzzle).toHaveBeenCalledTimes(1);
        expect(getPuzzle).toHaveBeenCalledWith('2026-11-02');
        // Still the first load, so the page isn't scrolled.
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('leaves the page alone once the visitor goes elsewhere', async () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        await mountPage('/cap-five?date=2026-11-01');
        getPuzzle.mockClear();
        // Mounted outside a RouterView, the view outlives the route change, as
        // it would under a KeepAlive; in the app's RouterView it unmounts first.
        await router.push('/teambuilder?date=2026-11-02');
        await flushPromises();
        expect(router.currentRoute.value.path).toBe('/teambuilder');
        await router.push('/teambuilder');
        await flushPromises();
        expect(getPuzzle).not.toHaveBeenCalled();
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('switches games when the query changes and scrolls back up', async () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        await mountPage();
        expect(scrollTo).not.toHaveBeenCalled();
        await router.push('/cap-five?date=2026-10-30');
        await flushPromises();
        expect(getPuzzle).toHaveBeenLastCalledWith('2026-10-30');
        expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it('goes to the new day once a lineup is locked in past midnight', async () => {
        vi.setSystemTime(new Date(2026, 10, 2, 23, 59));
        const w = await mountPage();
        vi.setSystemTime(new Date(2026, 10, 3, 0, 1));
        await lockIn(w);
        expect(readCapFiveGames()['2026-11-02'].archive).toBe(true);
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const focus = vi.spyOn(HTMLElement.prototype, 'focus');

        await todayLink(w).trigger('click');
        await flushPromises();
        expect(getPuzzle).toHaveBeenLastCalledWith('2026-11-03');
        expect(todayLink(w).exists()).toBe(false);
        expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
        expect(focus.mock.contexts.at(-1)?.textContent).toBe('Cap Five');
    });

    it("shares an archive day's own link", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        const w = await mountPage('/cap-five?date=2026-11-01');
        await lockIn(w);
        await w.get('[data-testid="share-copy"]').trigger('click');
        await flushPromises();
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/cap-five?date=2026-11-01'));
    });

    it("keeps stored results when today's puzzle is unavailable", async () => {
        seed('2026-11-01', { total: 415 });
        getPuzzle.mockResolvedValueOnce({ success: false, error: 'nope' });
        const w = await mountPage();
        expect(w.text()).toContain('No puzzle today');
        expect(archiveLinks(w)[0].text()).toContain('Perfect');
    });
});
