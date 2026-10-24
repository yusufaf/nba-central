<script setup lang="ts">
import { UserRound } from 'lucide-vue-next';
</script>

<template>
    <div
        data-testid="og-card"
        class="dark flex h-[39.375rem] w-[75rem] gap-12 overflow-hidden bg-background p-12 text-foreground">
        <!-- /cap-five's link preview, rendered to public/og-image-cap-five.png
             by `pnpm --filter web render:og`. It is the same every day, so it
             must never show a player, a cap or a rating: any of them could
             match a real puzzle. Sized in rem because it is only ever
             rendered on that script's page, at the default 16px root
             (75rem x 39.375rem = 1200x630). The tiles copy CapFiveShareCard's
             colours, the slots CapFiveLineup's empty ones. -->
        <div class="flex min-w-0 flex-1 flex-col justify-between">
            <div class="flex flex-col gap-3">
                <h1 class="text-8xl font-bold leading-none">Cap Five</h1>
                <p class="text-3xl text-muted-foreground">Pick five. Stay under the cap.</p>
            </div>

            <ol class="flex gap-4" aria-hidden="true">
                <li data-testid="preview-tile" class="size-20 rounded-lg bg-rating-elite" />
                <li data-testid="preview-tile" class="size-20 rounded-lg bg-rating-great" />
                <li data-testid="preview-tile" class="size-20 rounded-lg bg-rating-good" />
                <li data-testid="preview-tile" class="size-20 rounded-lg bg-rating-great" />
                <li data-testid="preview-tile" class="size-20 rounded-lg bg-muted-foreground/40" />
            </ol>

            <p class="text-2xl text-muted-foreground">nba.yusufaf.dev/cap-five</p>
        </div>

        <div class="flex w-[28rem] shrink-0 flex-col justify-center gap-4 rounded-lg bg-foreground/5 p-10">
            <ol class="flex flex-col gap-3" aria-hidden="true">
                <li
                    v-for="n in 5"
                    :key="n"
                    data-testid="preview-slot"
                    class="flex h-14 items-center gap-4 rounded-md border-2 border-dashed border-border px-4 text-2xl text-muted-foreground">
                    <UserRound class="size-8" aria-hidden="true" />
                    <span>Pick a player</span>
                </li>
            </ol>
            <div class="flex items-center gap-4">
                <span class="text-2xl font-semibold">Cap</span>
                <div class="h-4 flex-1 overflow-hidden rounded-full bg-muted">
                    <div class="h-full w-4/5 rounded-full bg-primary" />
                </div>
            </div>
        </div>
    </div>
</template>
