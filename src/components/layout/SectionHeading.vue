<script setup lang="ts">
/**
 * Section heading with the orange left rule, from the box score UX spec
 * (docs/superpowers/specs/2026-03-28-boxscore-ux-redesign.md).
 *
 * The rule and its label were previously repeated as inline styles across the
 * box score components, each copy free to drift.
 */
withDefaults(
    defineProps<{
        /** `micro` is the stat-column label size; `label` heads a section. */
        size?: 'label' | 'micro';
        /** Drop the orange rule where the heading sits inside a bordered card. */
        rule?: boolean;
    }>(),
    { size: 'label', rule: true },
);
</script>

<template>
    <h3
        class="section-heading"
        :data-size="size"
        :data-rule="rule || undefined"
    >
        <slot />
    </h3>
</template>

<style scoped>
.section-heading {
    color: hsl(var(--foreground) / 0.8);
    text-transform: uppercase;
    margin: 0;
}

.section-heading[data-rule] {
    border-left: 0.1875rem solid hsl(var(--primary));
    padding-left: 0.625rem;
}

.section-heading[data-size='label'] {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
}

.section-heading[data-size='micro'] {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: hsl(var(--foreground) / 0.6);
}
</style>
