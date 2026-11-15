<script setup lang="ts">
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { OUTFIT_STYLES, STAFF_ACCESSORIES, type OutfitStyleId, type StaffAppearance } from '@/constants/appearance';
import { OUTFIT_LABELS, OUTFIT_SWATCHES } from '@/utils/appearanceOptions';
import ColourField from './ColourField.vue';
import CreatorAccessories from './CreatorAccessories.vue';

// A coach's or GM's Outfit tab: the style, its two colours and glasses.
defineProps<{ disabled?: boolean }>();
const look = defineModel<StaffAppearance>('look', { required: true });

// A clear (clicking the selected toggle again) is ignored: the field is required.
const chooseStyle = (style: unknown) => {
    if (!style) return;
    look.value = { ...look.value, outfit: { ...look.value.outfit, style: style as OutfitStyleId } };
};
const setColour = (key: 'primary' | 'secondary', color: string) => {
    look.value = { ...look.value, outfit: { ...look.value.outfit, [key]: color } };
};
</script>

<template>
    <div class="grid gap-5">
        <div class="grid gap-2">
            <Label id="creator-outfit-label">Outfit</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="grid grid-cols-3 gap-2"
                aria-labelledby="creator-outfit-label"
                :model-value="look.outfit.style"
                :disabled="disabled"
                @update:model-value="chooseStyle"
            >
                <ToggleGroupItem v-for="style in OUTFIT_STYLES" :key="style" :value="style">
                    {{ OUTFIT_LABELS[style] }}
                </ToggleGroupItem>
            </ToggleGroup>
        </div>
        <ColourField
            :model-value="look.outfit.primary"
            label="Primary colour"
            :swatches="OUTFIT_SWATCHES"
            :disabled="disabled"
            @update:model-value="(color) => setColour('primary', color)"
        />
        <div class="grid gap-2">
            <ColourField
                :model-value="look.outfit.secondary"
                label="Secondary colour"
                :swatches="OUTFIT_SWATCHES"
                :disabled="disabled"
                @update:model-value="(color) => setColour('secondary', color)"
            />
            <p class="text-xs text-muted-foreground">The tie, collar and stripes.</p>
        </div>
        <CreatorAccessories
            :model-value="look.accessories"
            :options="STAFF_ACCESSORIES"
            :disabled="disabled"
            @update:model-value="(accessories) => (look = { ...look, accessories })"
        />
    </div>
</template>
