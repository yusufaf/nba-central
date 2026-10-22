<script setup lang="ts">
import { ArrowDown, ArrowUp, Shirt } from 'lucide-vue-next';
</script>

<template>
    <div
        data-testid="og-card"
        class="dark flex h-[39.375rem] w-[75rem] gap-12 overflow-hidden bg-background p-12 text-foreground">
        <!-- /daily's link preview, rendered to public/og-image-daily.png by
             `pnpm --filter web render:og`. It is the same every day, so it
             must never show a real jersey: any of them could be a puzzle.
             Sized in rem because it is only ever rendered on that script's
             page, at the default 16px root (75rem x 39.375rem = 1200x630).
             The tiles copy DailyEraShareCard's colours. -->
        <div class="flex min-w-0 flex-1 flex-col justify-between">
            <div class="flex flex-col gap-3">
                <h1 class="text-8xl font-bold leading-none">Which Era?</h1>
                <p class="text-3xl text-muted-foreground">Guess the season this jersey was worn</p>
            </div>

            <ol class="flex gap-4" aria-hidden="true">
                <li data-testid="preview-tile" class="flex size-20 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ArrowUp class="size-10" aria-hidden="true" />
                </li>
                <li
                    data-testid="preview-tile"
                    class="flex size-20 items-center justify-center rounded-lg border-4 border-primary-strong text-primary-strong">
                    <ArrowDown class="size-10" aria-hidden="true" />
                </li>
                <li
                    data-testid="preview-tile"
                    class="flex size-20 items-center justify-center rounded-lg bg-warning text-warning-foreground">
                    <ArrowUp class="size-10" aria-hidden="true" />
                </li>
                <li data-testid="preview-tile" class="flex size-20 items-center justify-center rounded-lg bg-success text-success-foreground" />
            </ol>

            <p class="text-2xl text-muted-foreground">nba.yusufaf.dev/daily</p>
        </div>

        <div class="relative flex w-[28rem] shrink-0 items-center justify-center rounded-lg bg-foreground/5">
            <Shirt class="size-80 text-muted-foreground/40" :stroke-width="1" aria-hidden="true" />
            <span class="absolute text-[10rem] font-bold leading-none text-primary">?</span>
        </div>
    </div>
</template>
