<script setup lang="ts">
import { computed } from "vue";
import { Check } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    checked?: boolean;
    id?: string;
  }>(),
  {
    checked: false,
    id: undefined,
  }
);

const emit = defineEmits<{
  'update:checked': [value: boolean];
}>();

// The app-wide checkbox styling in main.css is written with !important against
// [data-state="checked"], matching what Reka's primitives emit. The Tailwind
// classes below lose to it, so without this attribute a checked box paints as
// if it were empty.
const dataState = computed(() => (props.checked ? 'checked' : 'unchecked'));

const toggle = () => {
  emit('update:checked', !props.checked);
};
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="props.checked"
    :data-state="dataState"
    :id="props.id"
    @click.stop="toggle"
    class="relative inline-flex items-center justify-center shrink-0 rounded-md border-2 transition-colors cursor-pointer select-none"
    :class="[
      props.checked
        ? 'bg-amber-500 border-amber-500 text-zinc-950 shadow-sm'
        : 'bg-zinc-950 border-zinc-500 hover:border-zinc-400 text-transparent'
    ]"
    style="width: 1.25rem !important; height: 1.25rem !important; min-width: 1.25rem !important; min-height: 1.25rem !important; flex-shrink: 0 !important; padding: 0 !important; margin: 0 !important; line-height: 1 !important;"
  >
    <Check v-if="props.checked" class="w-3.5 h-3.5 stroke-[3.5]" />
  </button>
</template>
