<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';
import { ColorPicker } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Swatch } from '@/utils/appearanceOptions';
import { normaliseHex } from '@/utils/court';

// A colour from a row of swatches, a custom picker, or typed as hex.
const props = withDefaults(defineProps<{ label: string; swatches: Swatch[]; disabled?: boolean }>(), { disabled: false });
const model = defineModel<string>({ required: true });

const id = useId();
const swatchRow = ref<HTMLElement | null>(null);

const selectedIndex = computed(() => props.swatches.findIndex((swatch) => swatch.value === model.value));
const isCustom = computed(() => selectedIndex.value === -1);
// Roving focus: Tab lands on the chosen swatch (or the first), arrows move.
const focusIndex = computed(() => Math.max(selectedIndex.value, 0));

const choose = (index: number) => {
    model.value = props.swatches[index].value;
};

const onSwatchKey = async (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + props.swatches.length) % props.swatches.length;
    choose(next);
    await nextTick();
    swatchRow.value?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
};

const fromPicker = (value: string) => {
    const hex = normaliseHex(value);
    if (hex) model.value = hex;
};

// What's typed. A full #rrggbb applies at once; anything shorter waits for
// blur or Enter, so typing #aabbcc never applies #aaaabb on the way.
const draft = ref(model.value);
const invalid = ref(false);

watch(model, (value) => {
    draft.value = value;
    invalid.value = false;
});

const onInput = (value: string | number) => {
    draft.value = String(value);
    if (/^#[0-9a-f]{6}$/i.test(draft.value.trim())) {
        invalid.value = false;
        model.value = draft.value.trim().toLowerCase();
    }
};

const commit = () => {
    const hex = normaliseHex(draft.value);
    if (!hex) {
        invalid.value = true;
        return;
    }
    invalid.value = false;
    draft.value = hex;
    if (hex !== model.value) model.value = hex;
};
</script>

<template>
    <div class="grid gap-2">
        <Label :id="`${id}-label`">{{ label }}</Label>
        <div class="flex flex-wrap items-center gap-2">
            <div ref="swatchRow" class="flex flex-wrap items-center gap-2" role="radiogroup" :aria-labelledby="`${id}-label`">
                <button
                    v-for="(swatch, i) in swatches"
                    :key="swatch.value"
                    type="button"
                    role="radio"
                    class="creator-swatch"
                    :class="{ selected: i === selectedIndex }"
                    :style="{ backgroundColor: swatch.value }"
                    :aria-label="swatch.label"
                    :aria-checked="i === selectedIndex"
                    :tabindex="i === focusIndex ? 0 : -1"
                    :disabled="disabled"
                    @click="choose(i)"
                    @keydown="onSwatchKey($event, i)"
                />
            </div>
            <ColorPicker
                :model-value="model"
                :selected="isCustom"
                :label="`Custom ${label.toLowerCase()}`"
                :disabled="disabled"
                @update:model-value="fromPicker"
            />
        </div>
        <Input
            :id="`${id}-hex`"
            :model-value="draft"
            maxlength="9"
            spellcheck="false"
            autocomplete="off"
            class="h-9 w-32 font-mono"
            :aria-label="`${label} hex`"
            :aria-invalid="invalid ? 'true' : undefined"
            :aria-describedby="invalid ? `${id}-error` : undefined"
            :disabled="disabled"
            @update:model-value="onInput"
            @blur="commit"
            @keydown.enter.prevent="commit"
        />
        <p v-if="invalid" :id="`${id}-error`" class="text-xs text-destructive-strong">Use #rrggbb</p>
    </div>
</template>

<style scoped>
/* The court designer's swatch, a little larger for a thumb. */
.creator-swatch {
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    border: 0.125rem solid hsl(var(--border));
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.creator-swatch:hover {
    border-color: hsl(var(--primary) / 0.6);
}

.creator-swatch:focus-visible {
    outline: 0.125rem solid hsl(var(--ring));
    outline-offset: 0.125rem;
}

.creator-swatch.selected {
    border-color: hsl(var(--primary-strong));
    box-shadow: 0 0 0 0.125rem hsl(var(--primary) / 0.3);
}

.creator-swatch:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}
</style>
