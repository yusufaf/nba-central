<script setup lang="ts">
import CourtFloor from './CourtFloor.vue';
import type { CourtDesign } from '@/models/api';

// The starting five standing on the team's court. With five cards in a row
// the floor is tilted back behind them, like a broadcast camera; when the
// cards stack or wrap it's a band above the first one. The cards stay
// opaque in front. Without a court this renders the cards alone, exactly as
// before, so built-in arenas look the same as they always have.
defineProps<{
    court: CourtDesign | null | undefined;
    logoUrl?: string;
    // Five across. The parent decides, because it owns the grid's breakpoints.
    tilted: boolean;
}>();
</script>

<template>
    <slot v-if="!court" />
    <div v-else class="court-stage" :class="tilted ? 'is-tilted' : 'is-band'" data-testid="court-stage">
        <div class="court-stage-floor" aria-hidden="true">
            <div class="court-stage-plane">
                <CourtFloor
                    :court="court"
                    :logo-url="logoUrl"
                    :preserve-aspect-ratio="tilted ? 'xMidYMid meet' : 'xMidYMid slice'"
                    decorative
                />
            </div>
        </div>
        <div class="court-stage-content">
            <slot />
        </div>
    </div>
</template>

<style scoped>
/* The court's own colours never change with the theme; this frame does. */
.court-stage {
    position: relative;
    overflow: hidden;
    border-radius: 0.75rem;
    background: linear-gradient(to bottom, hsl(var(--muted) / 0.7), hsl(var(--background)));
}

.court-stage-content {
    position: relative;
}

/* Five across: the plane is anchored at the stage's bottom edge and tipped
   away, so the far sideline sits narrow above the cards. */
.is-tilted {
    padding: 9rem 2.25rem 2rem;
}

.is-tilted .court-stage-floor {
    position: absolute;
    inset: 0;
    perspective: 50rem;
    perspective-origin: 50% 0%;
    /* The plane's width also follows the stage's height, so short cards
       (the public page) get a smaller court instead of a zoomed-in one. */
    container-type: size;
}

.is-tilted .court-stage-plane {
    position: absolute;
    left: 50%;
    bottom: -3rem;
    width: min(116cqw, 360cqh);
    aspect-ratio: 104 / 58;
    transform: translateX(-50%) rotateX(56deg);
    transform-origin: 50% 100%;
}

/* Stacked or wrapped cards: a flat band, cropped to the middle of the
   court, with the first row overlapping its bottom edge. */
.is-band {
    padding-bottom: 1rem;
}

.is-band .court-stage-floor {
    height: 10rem;
}

.is-band .court-stage-plane {
    height: 100%;
}

.is-band .court-stage-content {
    margin-top: -3rem;
    padding-inline: 1rem;
}
</style>
