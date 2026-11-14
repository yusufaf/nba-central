<script setup lang="ts">
import { computed, useId } from 'vue';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

// One build slider, -1..1 in tenths; 0 is the body as its weight makes it.
const props = defineProps<{ label: string; low: string; high: string; disabled?: boolean }>();
const model = defineModel<number>({ required: true });

const id = useId();

const shown = computed(() => {
    const tenths = Math.round(model.value * 10) / 10;
    if (tenths === 0) return '0';
    return tenths > 0 ? `+${tenths.toFixed(1)}` : `−${Math.abs(tenths).toFixed(1)}`;
});

// The vendored Slider takes an array, one entry per thumb.
const onUpdate = (value: number[] | undefined) => {
    if (value) model.value = Math.round(value[0] * 10) / 10;
};
</script>

<template>
    <div class="grid gap-2">
        <div class="flex items-baseline justify-between gap-2">
            <Label :id="`${id}-label`">{{ label }}</Label>
            <span class="text-sm font-semibold tabular-nums" aria-hidden="true">{{ shown }}</span>
        </div>
        <Slider
            :model-value="[model]"
            :min="-1"
            :max="1"
            :step="0.1"
            :thumb-label="props.label"
            :disabled="disabled"
            @update:model-value="onUpdate"
        />
        <div class="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
            <span>{{ low }}</span>
            <span>Standard</span>
            <span>{{ high }}</span>
        </div>
    </div>
</template>
