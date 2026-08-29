<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { SheetVariants } from "."
import { reactiveOmit } from "@vueuse/core"
import { X } from "lucide-vue-next"
import {
  DialogClose,
  DialogContent,

  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"
import { sheetVariants } from "."

interface SheetContentProps extends DialogContentProps {
  class?: HTMLAttributes["class"]
  side?: SheetVariants["side"]
}

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<SheetContentProps>()

const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "side")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      :class="cn(sheetVariants({ side }), props.class)"
      v-bind="{ ...forwarded, ...$attrs }"
    >
      <slot />

      <DialogClose
        class="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md border border-border bg-foreground/5 text-foreground transition-colors hover:bg-foreground/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none"
      >
        <X class="size-5" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
