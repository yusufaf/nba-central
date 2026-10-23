<script setup lang="ts">
defineProps<{ gameVersion: string }>();
</script>

<template>
    <p class="text-xs text-muted-foreground">
        Ratings: NBA {{ gameVersion }} via
        <a
            href="https://www.2kratings.com"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-strong underline underline-offset-2"
        >2kratings.com</a>, frozen for this puzzle. Not affiliated with 2K or the NBA.
    </p>
</template>
