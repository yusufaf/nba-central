<template>
    <Card>
        <CardHeader class="pb-1 py-1.5">
            <h3 class="text-xs font-bold">Team Statistics</h3>
        </CardHeader>
        <CardContent class="space-y-2 p-2">
            <div v-for="stat in comparisonStats" :key="stat.name" class="stat-row">
                <div class="flex items-center justify-between mb-0.5">
                    <div class="text-[0.625rem] font-medium">{{ stat.label }}</div>
                </div>

                <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <!-- Away Team -->
                    <div class="flex items-center justify-end gap-1">
                        <span class="text-[0.625rem] font-semibold">{{ stat.awayValue }}</span>
                        <div class="flex-1 h-3 bg-muted rounded-full overflow-hidden flex justify-end">
                            <div
                                class="h-full rounded-full transition-all"
                                :class="stat.awayWins ? 'bg-primary' : 'bg-primary/40'"
                                :style="{ width: `${stat.awayPercent}%` }"
                            ></div>
                        </div>
                    </div>

                    <!-- Team Names -->
                    <div class="flex items-center gap-2 text-[0.5rem] text-muted-foreground min-w-[6rem]">
                        <span class="text-right flex-1">{{ awayTeam.team.abbreviation }}</span>
                        <span>vs</span>
                        <span class="text-left flex-1">{{ homeTeam.team.abbreviation }}</span>
                    </div>

                    <!-- Home Team -->
                    <div class="flex items-center gap-1">
                        <div class="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                                class="h-full rounded-full transition-all"
                                :class="stat.homeWins ? 'bg-primary' : 'bg-primary/40'"
                                :style="{ width: `${stat.homePercent}%` }"
                            ></div>
                        </div>
                        <span class="text-[0.625rem] font-semibold">{{ stat.homeValue }}</span>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { ESPNBoxScoreTeam } from '@/models/types';

interface Props {
    teams: ESPNBoxScoreTeam[];
}

const props = defineProps<Props>();

const awayTeam = computed(() => props.teams[0]);
const homeTeam = computed(() => props.teams[1]);

const comparisonStats = computed(() => {
    const stats = [
        { name: 'fieldGoalPct', label: 'Field Goal %', isPercentage: true },
        { name: 'threePointFieldGoalPct', label: 'Three Point %', isPercentage: true },
        { name: 'freeThrowPct', label: 'Free Throw %', isPercentage: true },
        { name: 'totalRebounds', label: 'Rebounds' },
        { name: 'assists', label: 'Assists' },
        { name: 'turnovers', label: 'Turnovers', lowerIsBetter: true },
        { name: 'steals', label: 'Steals' },
        { name: 'blocks', label: 'Blocks' },
        { name: 'fastBreakPoints', label: 'Fast Break Points' },
        { name: 'pointsInPaint', label: 'Points in Paint' },
        { name: 'benchPoints', label: 'Bench Points' },
    ];

    return stats
        .map(statConfig => {
            const awayStat = awayTeam.value.statistics.find(s => s.name === statConfig.name);
            const homeStat = homeTeam.value.statistics.find(s => s.name === statConfig.name);

            if (!awayStat || !homeStat) return null;

            const awayValue = parseFloat(awayStat.displayValue) || 0;
            const homeValue = parseFloat(homeStat.displayValue) || 0;

            const total = awayValue + homeValue;
            const awayPercent = total > 0 ? (awayValue / total) * 100 : 50;
            const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

            let awayWins = awayValue > homeValue;
            let homeWins = homeValue > awayValue;

            if (statConfig.lowerIsBetter) {
                awayWins = awayValue < homeValue && awayValue > 0;
                homeWins = homeValue < awayValue && homeValue > 0;
            }

            return {
                name: statConfig.name,
                label: statConfig.label,
                awayValue: statConfig.isPercentage ? `${awayValue}%` : awayValue.toString(),
                homeValue: statConfig.isPercentage ? `${homeValue}%` : homeValue.toString(),
                awayPercent: Math.max(awayPercent, 5), // Minimum 5% for visibility
                homePercent: Math.max(homePercent, 5),
                awayWins,
                homeWins,
            };
        })
        .filter((stat): stat is NonNullable<typeof stat> => stat !== null);
});
</script>
