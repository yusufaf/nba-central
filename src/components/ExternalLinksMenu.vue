<script setup lang="ts">
import { ExternalLink } from "lucide-vue-next";

defineProps<{
    links: { label: string; url: string }[];
}>();
</script>

<template>
    <span v-if="links.length" class="external-links-menu" @click.stop>
        <a
            v-for="link in links"
            :key="link.url"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            :title="link.label"
            class="external-link-icon"
        >
            <ExternalLink class="h-3.5 w-3.5" />
        </a>
    </span>
</template>

<style scoped>
.external-links-menu {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
}

.external-link-icon {
    display: inline-flex;
    color: hsl(var(--muted-foreground));
    transition: color 0.15s ease;
}

.external-link-icon:hover {
    color: hsl(var(--primary));
}
</style>
