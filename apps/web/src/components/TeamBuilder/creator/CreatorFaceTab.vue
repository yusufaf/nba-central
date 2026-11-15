<script setup lang="ts" generic="Look extends PersonAppearance | StaffAppearance">
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FACIAL_HAIR_STYLES, type FacialHairId, type PersonAppearance, type StaffAppearance } from '@/constants/appearance';
import { FACIAL_HAIR_LABELS, HAIR_SWATCHES, facialHairFits } from '@/utils/appearanceOptions';
import ColourField from './ColourField.vue';

const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });
const look = defineModel<Look>('look', { required: true });

const facialStyles = computed(() => FACIAL_HAIR_STYLES.filter((style) => facialHairFits(look.value.frame, style)));

// A clear (clicking the selected toggle again) is ignored: the field is required.
const chooseFacialHair = (style: unknown) => {
    if (!style) return;
    const next = style as FacialHairId;
    // A first beard starts in the hair's colour.
    const color = look.value.facialHair.style === 'none' && next !== 'none' ? look.value.hair.color : look.value.facialHair.color;
    look.value = { ...look.value, facialHair: { style: next, color } };
};
const setColour = (color: string) => {
    look.value = { ...look.value, facialHair: { ...look.value.facialHair, color } };
};
</script>

<template>
    <div class="grid gap-5">
        <div class="grid gap-2">
            <Label id="creator-facial-label">Facial hair</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="flex flex-wrap justify-start gap-2"
                aria-labelledby="creator-facial-label"
                :model-value="look.facialHair.style"
                :disabled="props.disabled"
                @update:model-value="chooseFacialHair"
            >
                <ToggleGroupItem v-for="style in facialStyles" :key="style" :value="style">
                    {{ FACIAL_HAIR_LABELS[style] }}
                </ToggleGroupItem>
            </ToggleGroup>
            <p v-if="facialStyles.length === 1" class="text-xs text-muted-foreground">No facial hair fits this frame yet.</p>
        </div>
        <ColourField
            v-if="look.facialHair.style !== 'none'"
            :model-value="look.facialHair.color"
            label="Facial hair colour"
            :swatches="HAIR_SWATCHES"
            :disabled="props.disabled"
            @update:model-value="setColour"
        />
        <p class="text-xs text-muted-foreground">Eyebrows follow the hair colour.</p>
    </div>
</template>
