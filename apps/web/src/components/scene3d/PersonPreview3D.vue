<script setup lang="ts">
// The player creator's 3D preview (#292). Loaded lazily through ./index.ts;
// never import it directly, or three.js lands in the page's own chunk.
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Focus, RotateCcw, RotateCw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import Scene3DUnavailable from './Scene3DUnavailable.vue';
import { track } from '@/lib/analytics';
import type { PersonInput } from '@/three/character/person';
import { onContextChange } from '@/three/renderer/shared';
import { PersonPreview } from '@/three/scene/personPreview';
import { HOME_KIT } from '@/utils/jerseyColours';

const props = defineProps<{ person: PersonInput; label: string }>();
const emit = defineEmits<{ failed: [reason: 'context-lost' | 'build'] }>();

// A player belongs to many teams: the preview wears the home kit, no name.
const PREVIEW_KIT = { colours: HOME_KIT, teamName: '' };
const STEP = Math.PI / 8;

const viewport = ref<HTMLElement | null>(null);
const preview = shallowRef<PersonPreview | null>(null);
const renderCount = ref(0);
const paused = ref(false);
const unavailable = ref(false);
// A build failed (a file didn't load): the figure shown, if any, is out of date.
const stale = ref(false);
let stopContext: (() => void) | null = null;

onMounted(() => {
    if (!viewport.value) return;
    let created: PersonPreview;
    try {
        created = new PersonPreview(viewport.value);
    } catch {
        unavailable.value = true;
        track('scene3d_failed', { reason: 'no-webgl', page: 'creator' });
        return;
    }
    created.onRender = () => (renderCount.value = created.renderCount);
    created.onError = () => {
        stale.value = true;
        emit('failed', 'build');
    };
    created.onShown = () => (stale.value = false);
    preview.value = created;
    stopContext = onContextChange((lost) => {
        paused.value = lost;
        if (lost) {
            emit('failed', 'context-lost');
            track('scene3d_failed', { reason: 'context-lost', page: 'creator' });
        } else {
            preview.value?.requestRender();
        }
    });
    created.setPerson(props.person, PREVIEW_KIT);
});

watch(
    () => props.person,
    (person) => preview.value?.setPerson(person, PREVIEW_KIT),
    { deep: true },
);

onBeforeUnmount(() => {
    stopContext?.();
    preview.value?.dispose();
    preview.value = null;
});
</script>

<template>
    <Scene3DUnavailable v-if="unavailable" reason="no-webgl" />
    <div v-else class="relative size-full overflow-hidden rounded-xl border border-border bg-card">
        <div ref="viewport" class="absolute inset-0" role="img" :aria-label="label" :data-render-count="renderCount" />
        <span class="pointer-events-none absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-xs text-foreground/80" aria-hidden="true">
            Drag to orbit
        </span>
        <div class="absolute right-2 bottom-2 flex gap-1">
            <Button size="icon" variant="outline" class="bg-background/85" aria-label="Rotate left" @click="preview?.rotate(-STEP)">
                <RotateCcw aria-hidden="true" />
            </Button>
            <Button size="icon" variant="outline" class="bg-background/85" aria-label="Rotate right" @click="preview?.rotate(STEP)">
                <RotateCw aria-hidden="true" />
            </Button>
            <Button size="icon" variant="outline" class="bg-background/85" aria-label="Reset view" @click="preview?.resetView()">
                <Focus aria-hidden="true" />
            </Button>
        </div>
        <p
            v-if="stale && !paused"
            class="absolute inset-x-2 top-2 mx-auto w-fit rounded-md bg-background/90 px-3 py-2 text-center text-sm"
            role="status"
        >
            The preview couldn't show this look. Your changes still save.
        </p>
        <p
            v-if="paused"
            class="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-md bg-background/90 px-3 py-2 text-sm"
            role="status"
        >
            3D view paused
        </p>
    </div>
</template>
