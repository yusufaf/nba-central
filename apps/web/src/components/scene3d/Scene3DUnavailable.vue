<script setup lang="ts">
import { computed } from 'vue';
import { Box } from 'lucide-vue-next';

const props = defineProps<{ reason: 'load' | 'no-webgl' }>();

const message = computed(() =>
    props.reason === 'no-webgl'
        ? "This browser can't show the 3D view. Everything below is the regular team page."
        : "The 3D view couldn't load. Everything below is the regular team page.",
);
</script>

<template>
    <p class="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm text-foreground/80" role="status">
        <Box class="size-5 shrink-0 text-foreground/50" aria-hidden="true" />
        {{ message }}
    </p>
</template>
