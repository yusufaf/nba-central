<script setup lang="ts">
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import ColourField from './creator/ColourField.vue';
import { LIGHTING_PRESETS, type LightingPresetId, type VenueDesign } from '@/constants/venue';
import {
    LIGHT_SWATCHES,
    LIGHTING_PRESET_HINTS,
    LIGHTING_PRESET_LABELS,
    lightingDesign,
    setLighting,
} from '@/utils/venue';

// The Lighting tab's settings (#298). Lighting always exists, so there is no
// opt-in: the tab starts on standard lighting (Broadcast, White), which is
// stored as no part at all. Never imports src/three: this tab is in the eager
// bundle, and three must stay in the lazy 3D chunk.
defineProps<{ disabled?: boolean }>();
const venue = defineModel<VenueDesign | null>('venue', { required: true });

const lighting = computed(() => lightingDesign(venue.value));

// A clear (clicking the selected toggle again) is ignored: a preset is required.
const choosePreset = (preset: unknown) => {
    if (preset) venue.value = setLighting(venue.value, { preset: preset as LightingPresetId });
};
const chooseTint = (tint: string) => {
    venue.value = setLighting(venue.value, { tint });
};
</script>

<template>
    <div class="grid gap-5">
        <div class="grid gap-2">
            <Label id="lighting-preset-label">Preset</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="grid grid-cols-2 gap-2"
                aria-labelledby="lighting-preset-label"
                :model-value="lighting.preset"
                :disabled="disabled"
                @update:model-value="choosePreset"
            >
                <ToggleGroupItem
                    v-for="preset in LIGHTING_PRESETS"
                    :key="preset"
                    :value="preset"
                    class="h-auto flex-col gap-1 py-2 whitespace-normal"
                >
                    <span>{{ LIGHTING_PRESET_LABELS[preset] }}</span>
                    <!-- The button's own text colour, so the hint reads on the selected (primary) fill too. -->
                    <span class="text-xs font-normal opacity-80">{{ LIGHTING_PRESET_HINTS[preset] }}</span>
                </ToggleGroupItem>
            </ToggleGroup>
        </div>

        <div class="grid gap-2">
            <ColourField
                :model-value="lighting.tint"
                label="Tint"
                :swatches="LIGHT_SWATCHES"
                :disabled="disabled"
                @update:model-value="chooseTint"
            />
            <p class="text-xs text-muted-foreground">
                Colours the arena's house lights. The court stays lit in white, and the scoreboard, ribbon and banners
                keep their own colours.
            </p>
        </div>
    </div>
</template>
