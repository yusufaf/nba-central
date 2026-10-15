<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { SearchX } from 'lucide-vue-next';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
</script>

<template>
    <PageShell width="narrow">
        <Card class="mx-auto flex max-w-[40rem] flex-col gap-4 p-6 sm:p-8">
            <SearchX class="size-8 text-foreground/60" aria-hidden="true" />
            <h1 class="text-[1.5rem] font-bold">This page doesn't exist</h1>
            <p>The link may be mistyped, or the page may have moved.</p>
            <Button as-child class="self-start">
                <RouterLink to="/">Go to the home page</RouterLink>
            </Button>
        </Card>
    </PageShell>
</template>
