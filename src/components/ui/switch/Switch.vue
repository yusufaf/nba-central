<script setup lang="ts">
import { computed } from "vue"
import {
  SwitchRoot,
  SwitchThumb,
} from "reka-ui"
import { cn } from "@/lib/utils"

interface Props {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  required?: boolean
  name?: string
  value?: string
  class?: any
}

const props = withDefaults(defineProps<Props>(), {
  checked: undefined,
  defaultChecked: undefined,
})

const emit = defineEmits<{
  'update:checked': [value: boolean]
}>()

const handleUpdateChecked = (value: boolean) => {
  console.log('Switch handleUpdateChecked called with:', value)
  emit('update:checked', value)
}
</script>

<template>
  <SwitchRoot
    v-model:checked="props.checked"
    :disabled="props.disabled"
    :class="cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      props.class,
    )"
  >
    <SwitchThumb
      :class="cn('pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5')"
    >
      <slot name="thumb" />
    </SwitchThumb>
  </SwitchRoot>
</template>
