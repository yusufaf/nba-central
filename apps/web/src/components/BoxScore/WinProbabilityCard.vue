<template>
    <Card v-if="visible" class="border-l-[0.1875rem] border-l-primary mb-2">
        <CardHeader class="pb-1 py-2">
            <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold text-sm">Win Probability</h3>
                <p v-if="isLive && lastPoint" data-testid="wp-live" class="flex items-center gap-3 text-[0.75rem] font-semibold tabular-nums">
                    <span class="inline-flex items-center gap-1">
                        <span class="inline-block size-2 rounded-full" :style="{ background: colors.home.fill }" />
                        {{ teams.home }} {{ formatWp(lastPoint.homeWp) }}
                    </span>
                    <span class="inline-flex items-center gap-1">
                        <span class="inline-block size-2 rounded-full" :style="{ background: colors.away.fill }" />
                        {{ teams.away }} {{ formatWp(1 - lastPoint.homeWp) }}
                    </span>
                </p>
            </div>
        </CardHeader>
        <CardContent class="p-3">
            <div class="grid gap-4" :class="{ 'lg:grid-cols-[minmax(0,1fr)_18rem]': swings.length > 0 }">
                <WinProbabilityChart
                    :series="series"
                    :swings="swings"
                    :colors="colors"
                    :teams="teams"
                    :periods="periods"
                    :active-play-id="activePlayId"
                />
                <BiggestPlays
                    v-if="swings.length"
                    :swings="swings"
                    :colors="colors"
                    :teams="teams"
                    :active-play-id="activePlayId"
                    @select="activePlayId = $event"
                />
            </div>
            <p class="mt-2 text-[0.6875rem] text-muted-foreground">Win probability: ESPN Analytics</p>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useResolvedTheme } from '@/composables/useDisplayPreferences';
import type { ESPNGameSummary } from '@/models/types';
import { REGULATION_PERIODS, biggestSwings, formatWp, pickWpColors, summaryWpSeries } from '@/utils/winProbability';
import WinProbabilityChart from '@/components/BoxScore/WinProbabilityChart.vue';
import BiggestPlays from '@/components/BoxScore/BiggestPlays.vue';

const props = defineProps<{ gameSummary: ESPNGameSummary }>();

const competition = computed(() => props.gameSummary.header?.competitions?.[0]);
const home = computed(() => competition.value?.competitors?.find((c) => c.homeAway === 'home'));
const away = computed(() => competition.value?.competitors?.find((c) => c.homeAway === 'away'));
const state = computed(() => competition.value?.status?.type?.state);
// useGameSummary's isLive is also true before tip-off, so read the state.
const isLive = computed(() => state.value === 'in');

const series = computed(() => summaryWpSeries(props.gameSummary));
const swings = computed(() => biggestSwings(series.value, 5));
const lastPoint = computed(() => series.value.at(-1));
const periods = computed(() => Math.max(REGULATION_PERIODS, lastPoint.value?.period ?? 0));

const theme = useResolvedTheme();
const NO_COLORS = { color: '', alternateColor: '' };
const colors = computed(() =>
    pickWpColors(home.value?.team ?? NO_COLORS, away.value?.team ?? NO_COLORS, theme.value),
);
const teams = computed(() => ({
    home: home.value?.team.abbreviation ?? '',
    away: away.value?.team.abbreviation ?? '',
}));

const visible = computed(() => !!home.value && !!away.value && state.value !== 'pre' && series.value.length >= 2);

// Keyed by play, not rank, so a live poll that reorders the top five keeps
// the same play selected.
const activePlayId = ref<string | null>(null);
watch(swings, (list) => {
    if (activePlayId.value && !list.some((s) => s.point.playId === activePlayId.value)) activePlayId.value = null;
});
</script>
