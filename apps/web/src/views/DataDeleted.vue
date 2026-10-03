<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { CircleCheck } from 'lucide-vue-next';
import PageShell from '@/layouts/PageShell.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
</script>

<template>
    <PageShell width="narrow">
        <Card class="mx-auto flex max-w-[40rem] flex-col gap-4 p-6 sm:p-8">
            <CircleCheck class="size-8 text-success" aria-hidden="true" />
            <h1 class="text-[1.5rem] font-bold">Your NBA Central data is deleted</h1>
            <p>
                Your teams and their public pages, your custom coaches, GMs and players, your
                settings, share cards and avatar are gone, and you're signed out on this device.
            </p>
            <p class="text-[0.8125rem] text-foreground/60">
                Your yusufaf.dev sign-in still works. Sign in here again to start fresh, or keep
                using it in other yusufaf.dev apps. Link previews that other sites already saved,
                like a shared team on X, Slack or Discord, are kept by those sites.
            </p>
            <Button as-child class="self-start">
                <RouterLink to="/">Go to the home page</RouterLink>
            </Button>
        </Card>
    </PageShell>
</template>
