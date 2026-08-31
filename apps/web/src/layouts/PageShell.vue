<script setup lang="ts">
/**
 * The single page container.
 *
 * Every route used to invent its own max-width and gutters — 90rem, 80rem,
 * 75rem and none, with gutters anywhere from 1rem to 4rem — so content never
 * lined up between pages. Width comes from the container tokens and the gutter
 * steps with the viewport via --gutter, defined once in main.css.
 */
withDefaults(
    defineProps<{
        /** `page` is the default wide layout; `narrow` suits reading views. */
        width?: 'page' | 'narrow' | 'full';
        /** Turn off vertical padding where a view manages its own rhythm. */
        flush?: boolean;
        /** Render as another element, so a view need not nest it in a <main>. */
        as?: string;
    }>(),
    { width: 'page', flush: false, as: 'div' },
);
</script>

<template>
    <component
        :is="as"
        class="page-shell"
        :data-width="width"
        :data-flush="flush || undefined"
    >
        <slot />
    </component>
</template>

<style scoped>
.page-shell {
    width: 100%;
    margin-inline: auto;
    padding-inline: var(--gutter);
    padding-block: 2rem;
}

.page-shell[data-flush] {
    padding-block: 0;
}

.page-shell[data-width='page'] {
    max-width: var(--container-page);
}

.page-shell[data-width='narrow'] {
    max-width: var(--container-narrow);
}

.page-shell[data-width='full'] {
    max-width: none;
}
</style>
