import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/network/api', () => ({
    capFiveApi: { getPuzzle: vi.fn(), submit: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import { toast } from 'vue-sonner';
import { capFiveApi } from '@/network/api';
import { track } from '@/lib/analytics';
import { useCapFive } from '@/composables/useCapFive';
import { readCapFiveGames, writeCapFiveGame } from '@/utils/capFive';
import { picks, puzzleView, result } from '../helpers/capFive';

const DAY = '2026-11-02';
const getPuzzle = vi.mocked(capFiveApi.getPuzzle);
const submitApi = vi.mocked(capFiveApi.submit);
const gone = Object.assign(new Error('Gone'), { response: { status: 410 } });

const loaded = async () => {
    const game = useCapFive();
    await game.load(DAY);
    return game;
};

const pickAll = (game: ReturnType<typeof useCapFive>) => picks.forEach((id) => game.toggle(id));

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 2, 12) });
    localStorage.clear();
    getPuzzle.mockResolvedValue({ success: true, data: puzzleView });
    submitApi.mockResolvedValue({ success: true, data: result() });
});

afterEach(() => vi.useRealTimers());

describe('useCapFive', () => {
    it("loads the day's pool to pick from", async () => {
        const game = await loaded();
        expect(getPuzzle).toHaveBeenCalledWith(DAY);
        expect(game.status.value).toBe('picking');
        expect(game.puzzle.value).toEqual(puzzleView);
        expect(track).toHaveBeenCalledWith('cap_five_viewed', { puzzleNumber: 12, state: 'new' });
    });

    it('stops at five picks and lets one go again', async () => {
        const game = await loaded();
        pickAll(game);
        game.toggle('c03');
        expect(game.picks.value).toEqual(picks);
        game.toggle('c04');
        game.toggle('c03');
        expect(game.picks.value).toEqual(['c01', 'c07', 'c02', 'c06', 'c03']);
    });

    it('submits five, stores the result and shows it', async () => {
        const game = await loaded();
        pickAll(game);
        expect(await game.submit()).toBe(true);
        expect(submitApi).toHaveBeenCalledWith({ date: DAY, picks });
        expect(game.status.value).toBe('submitted');
        expect(game.result.value).toEqual(result());
        expect(readCapFiveGames()[DAY]).toEqual({ result: result(), archive: false });
        expect(game.stats.value.currentStreak).toBe(1);
        expect(track).toHaveBeenCalledWith('cap_five_submitted', { puzzleNumber: 12, grade: 'close' });
    });

    it('refuses to submit fewer than five', async () => {
        const game = await loaded();
        game.toggle('c01');
        expect(await game.submit()).toBe(false);
        expect(submitApi).not.toHaveBeenCalled();
    });

    it('shows a stored day without asking the server', async () => {
        writeCapFiveGame(DAY, { result: result(), archive: false });
        const game = await loaded();
        expect(getPuzzle).not.toHaveBeenCalled();
        expect(game.status.value).toBe('submitted');
        expect(game.picks.value).toEqual(picks);
    });

    it('takes the result another tab locked in first', async () => {
        const game = await loaded();
        pickAll(game);
        writeCapFiveGame(DAY, { result: result({ total: 380 }), archive: false });
        expect(await game.submit()).toBe(false);
        expect(submitApi).not.toHaveBeenCalled();
        expect(game.status.value).toBe('submitted');
        expect(game.result.value?.total).toBe(380);
    });

    it('marks a lineup locked in after its day as archive', async () => {
        const game = await loaded();
        pickAll(game);
        vi.setSystemTime(new Date(2026, 10, 3, 0, 5));
        await game.submit();
        expect(game.archive.value).toBe(true);
        expect(game.stats.value.currentStreak).toBe(0);
    });

    it("doesn't carry the last game's archive flag into a new load", async () => {
        writeCapFiveGame('2026-11-01', { result: result({ date: '2026-11-01' }), archive: true });
        const game = useCapFive();
        await game.load('2026-11-01');
        expect(game.archive.value).toBe(true);
        await game.load(DAY);
        expect(game.status.value).toBe('picking');
        expect(game.archive.value).toBe(false);
    });

    it('is unavailable when the day has no puzzle', async () => {
        getPuzzle.mockRejectedValue(gone);
        expect((await loaded()).status.value).toBe('unavailable');
        getPuzzle.mockResolvedValue({ success: false, error: 'nope' });
        expect((await loaded()).status.value).toBe('unavailable');
    });

    it('is an error when the load fails otherwise', async () => {
        getPuzzle.mockRejectedValue(new Error('network'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect((await loaded()).status.value).toBe('error');
    });

    it('expires on a 410 submit and keeps the picks on any other failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const game = await loaded();
        pickAll(game);
        submitApi.mockRejectedValueOnce(new Error('network'));
        expect(await game.submit()).toBe(false);
        expect(toast.error).toHaveBeenCalled();
        expect(game.status.value).toBe('picking');
        expect(game.picks.value).toEqual(picks);

        submitApi.mockRejectedValueOnce(gone);
        await game.submit();
        expect(game.status.value).toBe('expired');
        expect(readCapFiveGames()).toEqual({});
    });
});
