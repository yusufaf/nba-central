<script setup lang="ts">
import { computed } from 'vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { APPEARANCE_FRAMES, type AppearanceFrame, type PersonAppearance } from '@/constants/appearance';
import {
    BODY_PRESETS,
    FRAME_LABELS,
    SKIN_SWATCHES,
    forFrame,
    presetMatching,
    type BodyProfile,
    type PresetId,
} from '@/utils/appearanceOptions';
import BuildSlider from './BuildSlider.vue';
import ColourField from './ColourField.vue';

// The Body tab: archetype presets, frame, the profile's height and weight,
// the build sliders and skin.
defineProps<{ disabled?: boolean }>();
const profile = defineModel<BodyProfile>('profile', { required: true });
const look = defineModel<PersonAppearance>('look', { required: true });

const presets = computed(() => BODY_PRESETS[look.value.frame]);
const preset = computed(() => presetMatching(look.value.frame, profile.value, look.value.build));

// reka clears a single toggle when its selected item is clicked again;
// every field here is required, so a clear is ignored.
const choosePreset = (id: unknown) => {
    const chosen = presets.value.find((p) => p.id === (id as PresetId));
    if (!chosen) return;
    profile.value = { heightFeet: chosen.heightFeet, heightInches: chosen.heightInches, weightPounds: chosen.weightPounds };
    look.value = { ...look.value, build: { ...chosen.build } };
};

const chooseFrame = (frame: unknown) => {
    if (!frame || frame === look.value.frame) return;
    look.value = forFrame(look.value, frame as AppearanceFrame);
};

const setProfile = (key: keyof BodyProfile, value: string | number) => {
    profile.value = { ...profile.value, [key]: value === '' ? Number.NaN : Number(value) };
};

const setBuild = (key: keyof PersonAppearance['build'], value: number) => {
    look.value = { ...look.value, build: { ...look.value.build, [key]: value } };
};

const presetSize = (p: BodyProfile) => `${p.heightFeet}′${p.heightInches}″ · ${p.weightPounds}`;
</script>

<template>
    <div class="grid gap-6">
        <div class="grid gap-2">
            <Label id="creator-preset-label">Archetype</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="grid grid-cols-2 gap-2 @min-[26rem]:grid-cols-4"
                aria-labelledby="creator-preset-label"
                :model-value="preset"
                :disabled="disabled"
                @update:model-value="choosePreset"
            >
                <ToggleGroupItem v-for="p in presets" :key="p.id" :value="p.id" class="h-auto flex-col gap-0.5 py-2">
                    <span class="font-semibold">{{ p.label }}</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ presetSize(p) }}</span>
                </ToggleGroupItem>
                <!-- Display only: selected whenever nothing else matches. -->
                <ToggleGroupItem value="custom" class="h-auto flex-col gap-0.5 py-2">
                    <span class="font-semibold">Custom</span>
                    <span class="text-xs text-muted-foreground">Manual</span>
                </ToggleGroupItem>
            </ToggleGroup>
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

        <div class="grid gap-4 @min-[26rem]:grid-cols-2">
            <fieldset class="grid gap-2">
                <legend class="mb-2 text-sm font-medium">Height</legend>
                <div class="grid grid-cols-2 gap-2">
                    <div class="grid gap-1">
                        <Label for="creator-height-feet" class="text-xs text-muted-foreground">Feet</Label>
                        <Input
                            id="creator-height-feet"
                            :model-value="Number.isFinite(profile.heightFeet) ? profile.heightFeet : ''"
                            type="number"
                            inputmode="numeric"
                            min="4"
                            max="8"
                            class="h-11"
                            :disabled="disabled"
                            @update:model-value="(v) => setProfile('heightFeet', v)"
                        />
                    </div>
                    <div class="grid gap-1">
                        <Label for="creator-height-inches" class="text-xs text-muted-foreground">Inches</Label>
                        <Input
                            id="creator-height-inches"
                            :model-value="Number.isFinite(profile.heightInches) ? profile.heightInches : ''"
                            type="number"
                            inputmode="numeric"
                            min="0"
                            max="11"
                            class="h-11"
                            :disabled="disabled"
                            @update:model-value="(v) => setProfile('heightInches', v)"
                        />
                    </div>
                </div>
            </fieldset>
            <div class="grid content-start gap-2">
                <Label for="creator-weight" class="mb-2">Weight (lbs)</Label>
                <Input
                    id="creator-weight"
                    :model-value="Number.isFinite(profile.weightPounds) ? profile.weightPounds : ''"
                    type="number"
                    inputmode="numeric"
                    min="100"
                    max="400"
                    class="h-11"
                    :disabled="disabled"
                    @update:model-value="(v) => setProfile('weightPounds', v)"
                />
            </div>
            <p class="text-xs text-muted-foreground @min-[26rem]:col-span-2">From the player's profile: 4′0″–8′11″, 100–400 lbs.</p>
        </div>

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
