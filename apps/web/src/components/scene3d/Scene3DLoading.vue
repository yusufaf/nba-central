<script setup lang="ts">
// The team scene's space while its chunk downloads (#300), so the page
// doesn't jump when it lands. Three-free: it is in the page's own chunk.
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { CAMERA_PRESETS, PRESET_LABELS, type CameraPreset } from '@/constants/cameraPresets';
import type { VenueDesign } from '@/constants/venue';
import { bannersDesign } from '@/utils/venue';
import { DEFAULT_VIEWPORT_CLASS } from './viewport';

// It is handed every prop the scene gets; only these shape it.
defineOptions({ inheritAttrs: false });
const props = withDefaults(
    defineProps<{ viewportClass?: string; presets?: readonly CameraPreset[]; venue?: VenueDesign | null }>(),
    { viewportClass: DEFAULT_VIEWPORT_CLASS, presets: () => CAMERA_PRESETS, venue: null },
);

// The same buttons the scene will offer, so the row wraps as the real one does.
const shown = computed(() => {
    const banners = bannersDesign(props.venue).length > 0;
    return props.presets.filter((option) => option !== 'banners' || banners);
});
</script>

<template>
    <div class="flex flex-col gap-3" data-testid="scene3d-loading">
        <div
            class="flex items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground"
            :class="viewportClass"
            role="status"
        >
            Loading 3D view…
        </div>
        <div class="invisible flex flex-wrap gap-2" aria-hidden="true" data-testid="scene3d-loading-row">
            <Button
                v-for="(option, index) in shown"
                :key="option"
                type="button"
                size="sm"
                :variant="index === 0 ? 'default' : 'outline'"
                tabindex="-1"
            >
                {{ PRESET_LABELS[option] }}
            </Button>
        </div>
    </div>
</template>
