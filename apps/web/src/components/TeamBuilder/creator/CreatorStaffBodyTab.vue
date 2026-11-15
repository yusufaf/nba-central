<script setup lang="ts">
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AGE_LOOKS, APPEARANCE_FRAMES, type AgeLookId, type AppearanceFrame, type StaffAppearance } from '@/constants/appearance';
import { AGE_LOOK_LABELS, FRAME_LABELS, SKIN_SWATCHES, forFrame } from '@/utils/appearanceOptions';
import BuildSlider from './BuildSlider.vue';
import ColourField from './ColourField.vue';
import type { StaffHeight } from './types';

// A coach's or GM's Body tab: age look, frame, height, build and skin. The
// height is a draft in feet and inches; the creator copies it into the look
// once it's in range.
defineProps<{ disabled?: boolean }>();
const look = defineModel<StaffAppearance>('look', { required: true });
const height = defineModel<StaffHeight>('height', { required: true });

// reka clears a single toggle when its selected item is clicked again;
// every field here is required, so a clear is ignored.
const chooseAge = (age: unknown) => {
    if (!age) return;
    look.value = { ...look.value, ageLook: age as AgeLookId };
};
const chooseFrame = (frame: unknown) => {
    if (!frame || frame === look.value.frame) return;
    look.value = forFrame(look.value, frame as AppearanceFrame);
};
const setHeight = (key: keyof StaffHeight, value: string | number) => {
    height.value = { ...height.value, [key]: value === '' ? Number.NaN : Number(value) };
};
const setBuild = (key: 'girth' | 'shoulders' | 'wingspan', value: number) => {
    look.value = { ...look.value, build: { ...look.value.build, [key]: value } };
};
</script>

<template>
    <div class="grid gap-6">
        <div class="grid gap-2">
            <Label id="creator-age-label">Age look</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="grid grid-cols-3 gap-2"
                aria-labelledby="creator-age-label"
                aria-describedby="creator-age-hint"
                :model-value="look.ageLook"
                :disabled="disabled"
                @update:model-value="chooseAge"
            >
                <ToggleGroupItem v-for="age in AGE_LOOKS" :key="age" :value="age">
                    {{ AGE_LOOK_LABELS[age] }}
                </ToggleGroupItem>
            </ToggleGroup>
            <p id="creator-age-hint" class="text-xs text-muted-foreground">Greys the hair; Veteran adds a little girth.</p>
        </div>

        <div class="grid gap-2">
            <Label id="creator-frame-label">Frame</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="grid grid-cols-2 gap-2"
                aria-labelledby="creator-frame-label"
                :model-value="look.frame"
                :disabled="disabled"
                @update:model-value="chooseFrame"
            >
                <ToggleGroupItem v-for="frame in APPEARANCE_FRAMES" :key="frame" :value="frame">
                    {{ FRAME_LABELS[frame] }}
                </ToggleGroupItem>
            </ToggleGroup>
        </div>

        <fieldset class="grid gap-2">
            <legend class="mb-2 text-sm font-medium">Height</legend>
            <div class="grid grid-cols-2 gap-2">
                <div class="grid gap-1">
                    <Label for="creator-height-feet" class="text-xs text-muted-foreground">Feet</Label>
                    <Input
                        id="creator-height-feet"
                        :model-value="Number.isFinite(height.feet) ? height.feet : ''"
                        type="number"
                        inputmode="numeric"
                        min="5"
                        max="7"
                        class="h-11"
                        :disabled="disabled"
                        @update:model-value="(v) => setHeight('feet', v)"
                    />
                </div>
                <div class="grid gap-1">
                    <Label for="creator-height-inches" class="text-xs text-muted-foreground">Inches</Label>
                    <Input
                        id="creator-height-inches"
                        :model-value="Number.isFinite(height.inches) ? height.inches : ''"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        max="11"
                        class="h-11"
                        :disabled="disabled"
                        @update:model-value="(v) => setHeight('inches', v)"
                    />
                </div>
            </div>
            <p class="text-xs text-muted-foreground">5′0″–7′6″.</p>
        </fieldset>

        <div class="grid gap-5">
            <BuildSlider :model-value="look.build.girth" label="Girth" low="Lean" high="Heavy" :disabled="disabled" @update:model-value="(v) => setBuild('girth', v)" />
            <BuildSlider
                :model-value="look.build.shoulders"
                label="Shoulders"
                low="Narrow"
                high="Broad"
                :disabled="disabled"
                @update:model-value="(v) => setBuild('shoulders', v)"
            />
            <BuildSlider
                :model-value="look.build.wingspan"
                label="Wingspan"
                low="Short"
                high="Long"
                :disabled="disabled"
                @update:model-value="(v) => setBuild('wingspan', v)"
            />
        </div>

        <ColourField
            :model-value="look.skin"
            label="Skin"
            :swatches="SKIN_SWATCHES"
            :disabled="disabled"
            @update:model-value="(skin) => (look = { ...look, skin })"
        />
    </div>
</template>
