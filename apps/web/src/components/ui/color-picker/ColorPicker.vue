<script setup lang="ts">
import type { Color } from "reka-ui";
import {
    ColorAreaArea,
    ColorAreaRoot,
    ColorAreaThumb,
    ColorFieldInput,
    ColorFieldRoot,
    ColorSliderRoot,
    ColorSliderThumb,
    ColorSliderTrack,
    ColorSwatch,
    colorToString,
    normalizeColor,
} from "reka-ui";
import { ref, watch } from "vue";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

withDefaults(defineProps<{ selected?: boolean }>(), { selected: false });

const modelValue = defineModel<string>({ required: true });

// Reka's color primitives operate on a Color object, not a hex string - this
// is the one place that boundary gets crossed, so every consumer (the jersey
// canvas, useJerseyDrawing) keeps dealing in plain hex.
const colorObj = ref<Color>(normalizeColor(modelValue.value));

// Only resync from the outside in. Comparing against the round-tripped hex,
// not the incoming value directly, means an edit that originated inside
// this picker (area drag, hue drag, hex field) is never mistaken for an
// external change and re-normalized mid-interaction.
watch(modelValue, (hex) => {
    if (hex !== colorToString(colorObj.value, "hex")) {
        colorObj.value = normalizeColor(hex);
    }
});

const handleColorUpdate = (next: Color) => {
    colorObj.value = next;
    modelValue.value = colorToString(next, "hex");
};

const handleHexUpdate = (hex: string) => {
    handleColorUpdate(normalizeColor(hex));
};
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <button
                type="button"
                class="color-picker-trigger"
                :class="{ selected }"
                :style="{ backgroundColor: modelValue }"
                aria-label="Custom color"
                title="Custom color"
            />
        </PopoverTrigger>

        <PopoverContent class="color-picker-content" :side-offset="8">
            <ColorAreaRoot
                v-slot="{ style }"
                :model-value="colorObj"
                color-space="hsl"
                x-channel="saturation"
                y-channel="lightness"
                @update:color="handleColorUpdate"
            >
                <ColorAreaArea class="color-picker-area" :style="style">
                    <ColorAreaThumb class="color-picker-thumb" />
                </ColorAreaArea>
            </ColorAreaRoot>

            <ColorSliderRoot
                :model-value="colorObj"
                channel="hue"
                color-space="hsl"
                class="color-picker-hue"
                @update:color="handleColorUpdate"
            >
                <ColorSliderTrack class="color-picker-hue-track" />
                <ColorSliderThumb class="color-picker-thumb" />
            </ColorSliderRoot>

            <div class="color-picker-hex-row">
                <ColorSwatch
                    :color="modelValue"
                    class="color-picker-swatch"
                    :style="{ backgroundColor: 'var(--reka-color-swatch-color)' }"
                />
                <ColorFieldRoot
                    :model-value="modelValue"
                    class="color-picker-hex-field"
                    @update:model-value="handleHexUpdate"
                >
                    <ColorFieldInput class="color-picker-hex-input" placeholder="#000000" />
                </ColorFieldRoot>
            </div>
        </PopoverContent>
    </Popover>
</template>

<style scoped>
.color-picker-trigger {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    border: 0.125rem solid hsl(var(--border));
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.color-picker-trigger:hover {
    border-color: hsl(var(--primary) / 0.6);
}

.color-picker-trigger.selected {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 0.125rem hsl(var(--primary) / 0.3);
}

.color-picker-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 16rem;
}

.color-picker-area {
    position: relative;
    width: 100%;
    height: 9rem;
    border-radius: var(--radius-sm);
    outline: none;
}

.color-picker-area:focus-visible {
    box-shadow: 0 0 0 0.125rem hsl(var(--ring));
}

/*
 * The drag thumbs stay a literal white ring, not a token - they sit on top
 * of whatever color is currently picked (any hue, any lightness), so they
 * need contrast against an unpredictable background rather than the app's
 * own dark theme.
 */
.color-picker-thumb {
    display: block;
    width: 1rem;
    height: 1rem;
    border-radius: 9999px;
    border: 0.125rem solid white;
    box-shadow: 0 0 0 0.0625rem hsl(0 0% 0% / 0.3);
    cursor: pointer;
}

.color-picker-thumb:focus-visible {
    outline: 0.125rem solid hsl(var(--ring));
    outline-offset: 0.125rem;
}

.color-picker-hue {
    position: relative;
    display: flex;
    align-items: center;
    height: 1rem;
}

/* Named colors, not hex - a literal hue sweep, not a themeable token. */
.color-picker-hue-track {
    position: relative;
    flex: 1;
    height: 0.5rem;
    border-radius: 9999px;
    background: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red);
}

.color-picker-hex-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.color-picker-swatch {
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    border: 0.0625rem solid hsl(var(--border));
}

.color-picker-hex-field {
    flex: 1;
}

.color-picker-hex-input {
    width: 100%;
    border-radius: var(--radius-sm);
    border: 0.0625rem solid hsl(var(--input));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    padding: 0.375rem 0.5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.8125rem;
}

.color-picker-hex-input:focus-visible {
    outline: none;
    box-shadow: 0 0 0 0.125rem hsl(var(--ring));
}
</style>
