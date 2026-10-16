<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { LockKeyhole } from 'lucide-vue-next';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
</script>

<template>
    <PageShell width="narrow">
        <Card class="mx-auto flex max-w-[40rem] flex-col gap-4 p-6 sm:p-8">
            <LockKeyhole class="size-8 text-foreground/60" aria-hidden="true" />
            <h1 class="text-[1.5rem] font-bold">Sign-in is turned off in PR previews</h1>
            <p>
                Everything that needs an account (saving teams, settings, feedback) only works on
                the real site.
            </p>
            <Button as-child class="self-start">
                <RouterLink to="/">Go to the home page</RouterLink>
            </Button>
        </Card>
    </PageShell>
</template>
