<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';

defineProps<{
    label: string;
    description?: string;
    /** The id of the control, so clicking the label operates it. */
    labelFor?: string;
    /** A save for this field is in flight. */
    saving?: boolean;
}>();
</script>

<template>
    <div class="setting-row" :aria-busy="saving || undefined">
        <div class="min-w-0">
            <div class="flex items-center gap-2">
                <label v-if="labelFor" :for="labelFor" class="setting-label cursor-pointer">
                    {{ label }}
                </label>
                <span v-else class="setting-label">{{ label }}</span>
                <Loader2
                    v-if="saving"
                    class="size-3.5 animate-spin text-primary"
                    aria-label="Saving"
                    data-testid="setting-saving"
                />
            </div>
            <p v-if="description" class="mt-0.5 text-[0.8125rem] text-foreground/60">
                {{ description }}
            </p>
        </div>
        <div class="shrink-0">
            <slot />
        </div>
    </div>
</template>

<style scoped>
.setting-row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-block: 1rem;
}

.setting-row + .setting-row {
    border-top: 0.0625rem solid hsl(var(--border));
}

@media (min-width: 640px) {
    .setting-row {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }
}

.setting-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}
</style>
