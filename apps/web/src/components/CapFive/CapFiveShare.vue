<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Copy, Download, Share2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { downloadBlobAsFile } from '@/utils/downloadFile';
import { capFiveShareText, capFiveShareUrl } from '@/utils/capFive';
import type { CapFiveResult } from '@/models/api';

const props = defineProps<{
    result: CapFiveResult;
    /** Null leaves the streak out. */
    streak: number | null;
}>();

const text = computed(() => capFiveShareText(props.result, props.streak, capFiveShareUrl()));
const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const shared = (method: 'copy' | 'native' | 'download') =>
    track('cap_five_shared', { puzzleNumber: props.result.puzzleNumber, method });

const copy = async () => {
    try {
        await navigator.clipboard.writeText(text.value);
        shared('copy');
        toast.success('Result copied');
    } catch (err) {
        console.error('Copying the Cap Five result failed:', err);
        toast.error("Couldn't copy the result");
    }
};

// Text only, as in DailyEraShare: the link unfurls, and rendering a file
// first could outlast the tap's user activation on iOS.
const shareNatively = async () => {
    try {
        await navigator.share({ text: text.value });
        shared('native');
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Sharing the Cap Five result failed:', err);
        toast.error("Couldn't open the share sheet");
    }
};

// Pre-rendered in idle time so a Download tap saves straight away (iOS
// Safari may refuse a download that starts after an await). The view keys
// this component by date and streak, so the card never goes stale.
const card = shallowRef<Blob | null>(null);
let pending: Promise<Blob> | null = null;
const prepare = () =>
    (pending ??= import('@/components/CapFive/capFiveCard')
        .then(({ renderCapFiveCard }) => renderCapFiveCard(props.result, props.streak))
        .then(
            (blob) => (card.value = blob),
            (err: unknown) => {
                pending = null;
                throw err;
            },
        ));

let scheduled: { kind: 'idle' | 'timeout'; id: number } | null = null;
onMounted(() => {
    const run = () => {
        scheduled = null;
        prepare().catch((err: unknown) => console.warn('Cap Five card pre-render failed:', err));
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
    const filename = `cap-five-${props.result.puzzleNumber}.png`;
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
        console.error('Making the Cap Five card failed:', err);
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
        <Button size="sm" variant="outline" data-testid="share-download" :disabled="downloading" @click="download">
            <Download aria-hidden="true" />
            Download image
        </Button>
    </div>
</template>
