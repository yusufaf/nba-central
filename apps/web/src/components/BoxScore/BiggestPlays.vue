<template>
    <div>
        <h4 class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-foreground/60 mb-1">Biggest Plays</h4>
        <ol class="space-y-0.5">
            <li v-for="swing in swings" :key="swing.point.playId">
                <button
                    type="button"
                    data-testid="wp-play"
                    class="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/60"
                    :class="{ 'bg-primary/10': swing.point.playId === activePlayId }"
                    :aria-pressed="swing.point.playId === activePlayId"
                    @click="toggle(swing.point.playId)"
                >
                    <span
                        class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold"
                        :style="chipStyle(swing)"
                    >{{ swing.rank }}</span>
                    <span class="min-w-0 flex-1">
                        <span class="line-clamp-2 text-[0.8125rem] leading-snug">{{ swing.point.text }}</span>
                        <span class="block text-[0.6875rem] text-foreground/60 tabular-nums">
                            {{ periodLabel(swing.point.period) }} · {{ swing.point.clock }}
                        </span>
                    </span>
                    <span
                        class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums"
                        :style="chipStyle(swing)"
                    >
                        <span class="sr-only">{{ teamFor(swing) }}</span>
                        {{ formatDelta(swing.actorDelta) }}
                    </span>
                </button>
            </li>
        </ol>
    </div>
</template>

<script setup lang="ts">
import { formatDelta, periodLabel, type WpSwing, type WpTeamColor } from '@/utils/winProbability';

const props = defineProps<{
    swings: WpSwing[];
    colors: { home: WpTeamColor; away: WpTeamColor };
    teams: { home: string; away: string };
    activePlayId: string | null;
}>();

const emit = defineEmits<{ select: [playId: string | null] }>();

const sideOf = (swing: WpSwing) => swing.point.side ?? 'home';

const chipStyle = (swing: WpSwing) => {
    const color = props.colors[sideOf(swing)];
    return { background: color.fill, color: color.ink };
};

const teamFor = (swing: WpSwing) => props.teams[sideOf(swing)];

const toggle = (playId: string) => emit('select', playId === props.activePlayId ? null : playId);
</script>
