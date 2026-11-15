<script setup lang="ts">
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ACCESSORIES, type AccessoryId, type PersonAppearance } from '@/constants/appearance';
import { ACCESSORY_LABELS, GEAR_SWATCHES, recolourAccessory, wearAccessories } from '@/utils/appearanceOptions';
import ColourField from './ColourField.vue';

// Staff are offered only glasses (STAFF_ACCESSORIES); players everything.
const props = withDefaults(defineProps<{ disabled?: boolean; options?: readonly AccessoryId[] }>(), {
    disabled: false,
    options: () => ACCESSORIES,
});
const model = defineModel<PersonAppearance['accessories']>({ required: true });
const bothEyewear = computed(() => props.options.includes('goggles') && props.options.includes('glasses'));

const wear = (ids: unknown) => {
    if (Array.isArray(ids)) model.value = wearAccessories(model.value, ids as AccessoryId[]);
};
</script>

<template>
    <div class="grid gap-5">
        <div class="grid gap-2">
            <Label id="creator-accessories-label">Accessories</Label>
            <ToggleGroup
                type="multiple"
                variant="outline"
                class="grid grid-cols-2 gap-2"
                aria-labelledby="creator-accessories-label"
                :model-value="model.map((a) => a.id)"
                :disabled="disabled"
                @update:model-value="wear"
            >
                <ToggleGroupItem v-for="id in options" :key="id" :value="id">
                    {{ ACCESSORY_LABELS[id] }}
                </ToggleGroupItem>
            </ToggleGroup>
            <p v-if="bothEyewear" class="text-xs text-muted-foreground">Goggles and glasses don't go together.</p>
        </div>
        <ColourField
            v-for="a in model"
            :key="a.id"
            :model-value="a.color"
            :label="`${ACCESSORY_LABELS[a.id]} colour`"
            :swatches="GEAR_SWATCHES"
            :disabled="disabled"
            @update:model-value="(color) => (model = recolourAccessory(model, a.id, color))"
        />
    </div>
</template>
