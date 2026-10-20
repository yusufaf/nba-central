<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Copy, Download, Share2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { downloadBlobAsFile } from '@/utils/downloadFile';
import type { DailyEraGuess } from '@/utils/dailyEra';
import { dailyEraShareResult, dailyEraShareText, dailyEraShareUrl } from '@/utils/dailyEraShare';

const props = defineProps<{
    puzzleNumber: number;
    guesses: DailyEraGuess[];
    imageUrl: string;
    /** The puzzle's local YYYY-MM-DD. */
    date: string;
    archive: boolean;
    /** Null leaves the streak out. */
    streak: number | null;
}>();

const result = computed(() =>
    dailyEraShareResult({ puzzleNumber: props.puzzleNumber, guesses: props.guesses }, props.streak),
);
const text = computed(() => dailyEraShareText(result.value, dailyEraShareUrl(props.date, props.archive)));
const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const shared = (method: 'copy' | 'native' | 'download') =>
    track('daily_era_shared', { puzzleNumber: props.puzzleNumber, method, archive: props.archive });

const copy = async () => {
    try {
        await navigator.clipboard.writeText(text.value);
        shared('copy');
        toast.success('Result copied');
    } catch (err) {
        console.error('Copying the Daily Era result failed:', err);
        toast.error("Couldn't copy the result");
    }
};

// Text only: the link in it unfurls, and rendering a file first could
// outlast the tap's user activation on iOS.
const shareNatively = async () => {
    try {
        await navigator.share({ text: text.value });
        shared('native');
    } catch (err) {
        // Dismissing the sheet rejects with an AbortError: nothing to report.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Sharing the Daily Era result failed:', err);
        toast.error("Couldn't open the share sheet");
    }
};

// The card is rendered ahead of time, in idle time once the game is over, so
// a Download tap saves it straight away: iOS Safari may refuse a download
// that starts after an await. The view keys this component by date, so the
// card never goes stale. Loaded on demand, which keeps html-to-image out of
// the page's first load.
const card = shallowRef<Blob | null>(null);
let pending: Promise<Blob> | null = null;
const prepare = () =>
    (pending ??= import('@/components/DailyEra/dailyEraCard')
        .then(({ renderDailyEraCard }) => renderDailyEraCard(result.value, props.imageUrl))
        .then(
            (blob) => (card.value = blob),
            (err: unknown) => {
                // Forget the failure, so the next tap tries again.
                pending = null;
                throw err;
            },
        ));

let scheduled: { kind: 'idle' | 'timeout'; id: number } | null = null;
onMounted(() => {
    const run = () => {
        scheduled = null;
        prepare().catch((err: unknown) => console.warn('Daily Era card pre-render failed:', err));
    };
    scheduled =
        typeof window.requestIdleCallback === 'function'
            ? { kind: 'idle', id: window.requestIdleCallback(run) }
            : { kind: 'timeout', id: window.setTimeout(run, 200) };
});
onBeforeUnmount(() => {
    if (scheduled?.kind === 'idle') window.cancelIdleCallback(scheduled.id);
    else if (scheduled) window.clearTimeout(scheduled.id);
});

const downloading = ref(false);
const download = async () => {
    const filename = `which-era-${props.puzzleNumber}.png`;
    if (card.value) {
        downloadBlobAsFile(card.value, filename);
        shared('download');
        return;
    }
    downloading.value = true;
    try {
        downloadBlobAsFile(await prepare(), filename);
        shared('download');
    } catch (err) {
        console.error('Making the Daily Era card failed:', err);
        toast.error("Couldn't make the image");
    } finally {
        downloading.value = false;
    }
};
</script>

<template>
    <div class="flex flex-wrap gap-2">
        <Button size="sm" data-testid="share-copy" @click="copy">
            <Copy aria-hidden="true" />
            Copy result
        </Button>
        <Button v-if="canShareNatively" size="sm" variant="outline" data-testid="share-native" @click="shareNatively">
            <Share2 aria-hidden="true" />
            Share…
        </Button>
        <Button
            size="sm"
            variant="outline"
            data-testid="share-download"
            :disabled="downloading"
            @click="download"
        >
            <Download aria-hidden="true" />
            Download image
        </Button>
    </div>
</template>
