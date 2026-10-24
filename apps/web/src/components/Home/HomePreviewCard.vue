<script setup lang="ts">
// Bound, not a literal src: the Vue compiler turns a literal public/ path into
// a module import, which vitest can't resolve.
const poster = '/hero/hero-poster.jpg';
</script>

<template>
    <div
        data-testid="og-card"
        class="dark relative flex h-[39.375rem] w-[75rem] flex-col justify-between overflow-hidden bg-background p-12 text-foreground">
        <!-- The home page's link preview (index.html's og:image, and the
             README image), rendered to public/og-image-home.jpg by
             `pnpm --filter web render:og`. It copies Home.vue's hero: the
             poster, under a darker scrim so the smaller lines stay legible
             at thumbnail size, and TypeWriter's headline with its first
             word. The whole headline is hard-coded, not read from
             TYPE_WRITER_PROPS: this card must match the committed JPEG and
             index.html's og:image:alt, which only change on a re-render.
             Sized in rem because it is only ever rendered on that
             script's page, at the default 16px root (75rem x 39.375rem =
             1200x630). JPEG, not PNG, because the photo makes a PNG several
             times larger. -->
        <img :src="poster" alt="" class="absolute inset-0 size-full object-cover">
        <div class="absolute inset-0 bg-linear-to-b from-background/50 to-background/80" />

        <p class="relative text-3xl font-bold">nba-central</p>

        <div class="relative text-center">
            <h1 class="text-8xl font-normal leading-none">
                Build the <span data-testid="headline-word" class="text-primary-strong">GOAT</span> team
            </h1>
            <p class="mt-6 text-3xl text-foreground/85">Draft any player in NBA history. Add a coach, GM and arena.</p>
        </div>

        <p class="relative text-2xl text-foreground/85">nba.yusufaf.dev</p>
    </div>
</template>
