import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Dialog } from "./Dialog.vue"
export { default as DialogClose } from "./DialogClose.vue"
export { default as DialogContent } from "./DialogContent.vue"
export { default as DialogDescription } from "./DialogDescription.vue"
export { default as DialogFooter } from "./DialogFooter.vue"
export { default as DialogHeader } from "./DialogHeader.vue"
export { default as DialogOverlay } from "./DialogOverlay.vue"
export { default as DialogScrollContent } from "./DialogScrollContent.vue"
export { default as DialogTitle } from "./DialogTitle.vue"
export { default as DialogTrigger } from "./DialogTrigger.vue"

// Width lives here rather than in a global [role="dialog"] rule. That rule set
// one max-width for every dialog with !important, which also caught reka's
// Popover — it renders role="dialog" too — and then needed ~200 lines of
// popover-specific CSS to claw the modal sizing back off.
export const dialogVariants = cva(
  "fixed left-1/2 top-1/2 z-[var(--z-modal)] grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-card p-8 text-card-foreground shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  {
    variants: {
      size: {
        default: "max-w-2xl",
        sm: "max-w-md",
        // For dialogs holding wide tabular data. The player stats table is 21
        // columns; at the default width only about a third of it is reachable.
        wide: "max-w-[min(95vw,110rem)] p-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
)

export type DialogVariants = VariantProps<typeof dialogVariants>
