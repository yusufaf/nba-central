import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/utils/downloadFile', () => ({ downloadBlobAsFile: vi.fn() }));
vi.mock('@/components/DailyEra/dailyEraCard', () => ({
    renderDailyEraCard: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
}));

import { toast } from 'vue-sonner';
import { track } from '@/lib/analytics';
import { downloadBlobAsFile } from '@/utils/downloadFile';
import { renderDailyEraCard } from '@/components/DailyEra/dailyEraCard';
import DailyEraShare from '@/components/DailyEra/DailyEraShare.vue';
import { close, far, hit } from '../helpers/dailyEraShare';

const IMAGE = 'https://cdn.example/daily-era/abc.webp';
const daily = {
    puzzleNumber: 12,
    guesses: [far(1960, 'later'), close(1990, 'earlier'), hit(1988)],
    imageUrl: IMAGE,
    date: '2026-10-20',
    archive: false,
    streak: 5,
};
const TEXT = `Which Era? #12 3/4 🔥5 ⬛⬆️ 🟨⬇️ 🟩 ${window.location.origin}/daily`;

const writeText = vi.fn();
const render = vi.mocked(renderDailyEraCard);
const rendered = () => vi.waitFor(() => expect(render).toHaveBeenCalled()).then(flushPromises);

beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
        cb();
        return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'share');
});

describe('DailyEraShare copy and share', () => {
    it('copies the one-line result', async () => {
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-copy"]').trigger('click');
        await flushPromises();
        expect(writeText).toHaveBeenCalledWith(TEXT);
        expect(toast.success).toHaveBeenCalledWith('Result copied');
        expect(track).toHaveBeenCalledWith('daily_era_shared', { puzzleNumber: 12, method: 'copy', archive: false });
    });

    it('says so when the clipboard refuses', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        writeText.mockRejectedValueOnce(new Error('denied'));
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-copy"]').trigger('click');
        await flushPromises();
        expect(toast.error).toHaveBeenCalledWith("Couldn't copy the result");
    });

    it('links an archive game by its date, with no streak', async () => {
        const w = mount(DailyEraShare, { props: { ...daily, date: '2026-10-12', archive: true, streak: null } });
        await w.get('[data-testid="share-copy"]').trigger('click');
        await flushPromises();
        const text = writeText.mock.calls[0][0] as string;
        expect(text).toMatch(/\/daily\?date=2026-10-12$/);
        expect(text).not.toContain('🔥');
    });

    it('offers the share sheet only where there is one', async () => {
        expect(mount(DailyEraShare, { props: daily }).find('[data-testid="share-native"]').exists()).toBe(false);

        const share = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { share });
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-native"]').trigger('click');
        await flushPromises();
        expect(share).toHaveBeenCalledWith({ text: TEXT });
        expect(track).toHaveBeenCalledWith('daily_era_shared', { puzzleNumber: 12, method: 'native', archive: false });
    });

    it('says nothing about a dismissed share sheet, and counts no share', async () => {
        Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError')) });
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-native"]').trigger('click');
        await flushPromises();
        expect(toast.error).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
    });

    it('reports a share sheet that failed to open', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('no gesture', 'NotAllowedError')) });
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-native"]').trigger('click');
        await flushPromises();
        expect(toast.error).toHaveBeenCalledWith("Couldn't open the share sheet");
        expect(track).not.toHaveBeenCalled();
    });

    it('counts a refused copy as no share', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        writeText.mockRejectedValueOnce(new Error('denied'));
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-copy"]').trigger('click');
        await flushPromises();
        expect(track).not.toHaveBeenCalled();
    });
});

describe('DailyEraShare download', () => {
    it('renders the card once, ahead of time, and saves it on the tap itself', async () => {
        const w = mount(DailyEraShare, { props: daily });
        await rendered();
        expect(render).toHaveBeenCalledWith(expect.objectContaining({ puzzleNumber: 12, streak: 5 }), IMAGE);

        (w.get('[data-testid="share-download"]').element as HTMLButtonElement).click();
        expect(downloadBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), 'which-era-12.png');
        (w.get('[data-testid="share-download"]').element as HTMLButtonElement).click();
        expect(render).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith('daily_era_shared', { puzzleNumber: 12, method: 'download', archive: false });
    });

    it('renders on the tap when idle time never came', async () => {
        vi.stubGlobal('requestIdleCallback', () => 1);
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-download"]').trigger('click');
        await rendered();
        expect(downloadBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), 'which-era-12.png');
    });

    it('tries again on the next tap after a failed render', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('requestIdleCallback', () => 1);
        render.mockRejectedValueOnce(new Error('tainted'));
        const w = mount(DailyEraShare, { props: daily });
        await w.get('[data-testid="share-download"]').trigger('click');
        await rendered();
        expect(toast.error).toHaveBeenCalledWith("Couldn't make the image");
        expect(track).not.toHaveBeenCalled();

        await w.get('[data-testid="share-download"]').trigger('click');
        await vi.waitFor(() => expect(downloadBlobAsFile).toHaveBeenCalled());
        expect(render).toHaveBeenCalledTimes(2);
    });

    it('cancels the idle render when it leaves first', () => {
        vi.stubGlobal('requestIdleCallback', () => 7);
        mount(DailyEraShare, { props: daily }).unmount();
        expect(cancelIdleCallback).toHaveBeenCalledWith(7);
    });

    it('falls back to a timer without requestIdleCallback, and clears it on unmount', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('requestIdleCallback', undefined);
        const left = mount(DailyEraShare, { props: daily });
        vi.advanceTimersByTime(100);
        left.unmount();
        vi.advanceTimersByTime(500);
        expect(render).not.toHaveBeenCalled();

        mount(DailyEraShare, { props: daily });
        await vi.advanceTimersByTimeAsync(200);
        vi.useRealTimers();
        await rendered();
        expect(render).toHaveBeenCalledTimes(1);
    });
});
