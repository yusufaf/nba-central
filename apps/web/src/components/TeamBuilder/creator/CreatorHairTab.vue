<script setup lang="ts" generic="Look extends PersonAppearance | StaffAppearance">
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { HAIR_STYLES, type HairStyleId, type PersonAppearance, type StaffAppearance } from '@/constants/appearance';
import { HAIR_LABELS, HAIR_SWATCHES, fits } from '@/utils/appearanceOptions';
import ColourField from './ColourField.vue';

const props = withDefaults(defineProps<{ disabled?: boolean; colourHint?: string | null }>(), {
    disabled: false,
    colourHint: null,
});
const look = defineModel<Look>('look', { required: true });

const hairStyles = computed(() => HAIR_STYLES.filter((style) => fits(look.value.frame, style)));

// reka clears a single toggle when its selected item is clicked again;
// every look field is required, so a clear is ignored.
const chooseHair = (style: unknown) => {
    if (!style) return;
    look.value = { ...look.value, hair: { ...look.value.hair, style: style as HairStyleId } };
};
const setColour = (color: string) => {
    look.value = { ...look.value, hair: { ...look.value.hair, color } };
};
</script>

<template>
    <div class="grid gap-5">
        <div class="grid gap-2">
            <Label id="creator-hair-label">Style</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="flex flex-wrap justify-start gap-2"
                aria-labelledby="creator-hair-label"
                :model-value="look.hair.style"
                :disabled="props.disabled"
                @update:model-value="chooseHair"
            >
                <ToggleGroupItem v-for="style in hairStyles" :key="style" :value="style">
                    {{ HAIR_LABELS[style] }}
                </ToggleGroupItem>
            </ToggleGroup>
            <p class="text-xs text-muted-foreground">The styles that fit this frame's head.</p>
        </div>
        <div class="grid gap-2">
            <ColourField
                :model-value="look.hair.color"
                label="Hair colour"
                :swatches="HAIR_SWATCHES"
                :disabled="props.disabled"
                @update:model-value="setColour"
            />
            <p v-if="props.colourHint" class="text-xs text-muted-foreground">{{ props.colourHint }}</p>
        </div>
    </div>
</template>
