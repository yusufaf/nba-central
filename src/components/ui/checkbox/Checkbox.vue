<script setup lang="ts">
import { computed } from "vue";
import { Check } from "lucide-vue-next";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

/*
 * Wraps reka's CheckboxRoot, which is where the keyboard handling, the
 * aria-checked bookkeeping and the hidden form input live.
 *
 * This was previously a hand-rolled <button role="checkbox"> carrying eight
 * inline !important declarations, written that way only to escape the
 * app-wide button[role="checkbox"] rules in main.css. Those rules are gone,
 * so the primitive can do its job again.
 *
 * reka 2.x names the prop modelValue; the app uses v-model:checked, so the
 * two are mapped here rather than churning every call site.
 */
const props = withDefaults(
    defineProps<{
        checked?: boolean;
        id?: string;
        disabled?: boolean;
        class?: HTMLAttributes["class"];
    }>(),
    { checked: false, id: undefined, disabled: false },
);

const emit = defineEmits<{
    "update:checked": [value: boolean];
}>();

const model = computed({
    get: () => props.checked,
    set: (value) => emit("update:checked", value === true),
});
</script>

<template>
    <CheckboxRoot
        :id="props.id"
        v-model="model"
        :disabled="props.disabled"
        :class="
            cn(
                'peer inline-flex size-5 shrink-0 items-center justify-center rounded border-2 border-muted-foreground bg-background text-primary-foreground transition-colors hover:border-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
                props.class,
            )
        "
    >
        <CheckboxIndicator class="flex items-center justify-center">
            <Check class="size-3.5 stroke-[3]" />
        </CheckboxIndicator>
    </CheckboxRoot>
</template>
