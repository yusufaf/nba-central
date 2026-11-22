<script setup lang="ts">
import { computed } from 'vue';
import { Box } from 'lucide-vue-next';

const props = defineProps<{ reason: 'load' | 'no-webgl' | 'context-lost' }>();

const MESSAGES = {
    'no-webgl': "This browser can't show the 3D view. Everything else still works.",
    load: "The 3D view couldn't load. Everything else still works.",
    'context-lost': 'The 3D view stopped working. Everything else still works.',
};
const message = computed(() => MESSAGES[props.reason]);
</script>

<template>
    <p class="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm text-foreground/80" role="status">
        <Box class="size-5 shrink-0 text-foreground/50" aria-hidden="true" />
        {{ message }}
    </p>
</template>
