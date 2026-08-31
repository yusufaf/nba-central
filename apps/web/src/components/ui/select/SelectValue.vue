<script setup lang="ts">
import type { SelectValueProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { SelectValue } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<SelectValueProps & { class?: HTMLAttributes["class"] }>()
</script>

<template>
  <SelectValue v-bind="props" :class="cn('flex items-center leading-normal', props.class)">
    <slot />
  </SelectValue>
</template>
