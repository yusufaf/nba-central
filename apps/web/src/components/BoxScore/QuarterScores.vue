<template>
    <Card v-if="hasLineScores">
        <CardContent class="p-3 overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow class="text-xs uppercase text-foreground/60">
                        <TableHead class="w-[10rem] pt-[0.35rem] pb-[0.35rem]">Team</TableHead>
                        <TableHead
                            v-for="period in periods"
                            :key="period.period"
                            class="text-center pt-[0.35rem] pb-[0.35rem]"
                        >
                            {{ period.label }}
                        </TableHead>
                        <TableHead class="text-center font-bold pt-[0.35rem] pb-[0.35rem]">Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <!-- Away Team Row -->
                    <TableRow>
                        <TableCell class="font-semibold text-sm py-[0.35rem]">
                            <div class="flex items-center gap-2">
                                <img
                                    v-if="awayTeam.team.logo"
                                    :src="awayTeam.team.logo"
                                    :alt="awayTeam.team.abbreviation"
                                    class="object-contain shrink-0 w-6 h-6"
                                />
                                <span>{{ awayTeam.team.abbreviation }}</span>
                            </div>
                        </TableCell>
                        <TableCell
                            v-for="period in periods"
                            :key="`away-${period.period}`"
                            class="text-center text-sm py-[0.35rem] text-foreground tabular-nums"
                            :class="{ 'bg-primary/10 font-semibold': awayPeriodScores[period.period] > homePeriodScores[period.period] }"
                        >
                            {{ awayPeriodScores[period.period] }}
                        </TableCell>
                        <TableCell
                            class="text-center font-bold text-lg py-[0.35rem] tabular-nums"
                            :class="awayTeam.winner ? 'text-primary' : ''"
                        >
                            {{ awayTeam.score }}
                        </TableCell>
                    </TableRow>

                    <!-- Home Team Row -->
                    <TableRow>
                        <TableCell class="font-semibold text-sm py-[0.35rem]">
                            <div class="flex items-center gap-2">
                                <img
                                    v-if="homeTeam.team.logo"
                                    :src="homeTeam.team.logo"
                                    :alt="homeTeam.team.abbreviation"
                                    class="object-contain shrink-0 w-6 h-6"
                                />
                                <span>{{ homeTeam.team.abbreviation }}</span>
                            </div>
                        </TableCell>
                        <TableCell
                            v-for="period in periods"
                            :key="`home-${period.period}`"
                            class="text-center text-sm py-[0.35rem] text-foreground tabular-nums"
                            :class="{ 'bg-primary/10 font-semibold': homePeriodScores[period.period] > awayPeriodScores[period.period] }"
                        >
                            {{ homePeriodScores[period.period] }}
                        </TableCell>
                        <TableCell
                            class="text-center font-bold text-lg py-[0.35rem] tabular-nums"
                            :class="homeTeam.winner ? 'text-primary' : ''"
                        >
                            {{ homeTeam.score }}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ESPNCompetitor } from '@/models/types';

interface Props {
    competitors: ESPNCompetitor[];
}

const props = defineProps<Props>();

const awayTeam = computed(() => props.competitors.find(c => c.homeAway === 'away')!);
const homeTeam = computed(() => props.competitors.find(c => c.homeAway === 'home')!);

// Check if we have any line scores to display
const hasLineScores = computed(() => {
    const awayScores = awayTeam.value.linescores?.length || 0;
    const homeScores = homeTeam.value.linescores?.length || 0;
    return awayScores > 0 || homeScores > 0;
});

// Build period labels (Q1, Q2, Q3, Q4, OT, OT2, etc.)
const periods = computed(() => {
    const maxPeriods = Math.max(
        awayTeam.value.linescores?.length || 0,
        homeTeam.value.linescores?.length || 0
    );

    return Array.from({ length: maxPeriods }, (_, i) => {
        const period = i + 1;
        let label = '';

        if (period <= 4) {
            label = `Q${period}`;
        } else if (period === 5) {
            label = 'OT';
        } else {
            label = `OT${period - 4}`;
        }

        return { period, label };
    });
});

// Build score maps for easy lookup
const awayPeriodScores = computed(() => {
    const scores: Record<number, number> = {};
    awayTeam.value.linescores?.forEach((ls, index) => {
        scores[index + 1] = ls.value;
    });
    return scores;
});

const homePeriodScores = computed(() => {
    const scores: Record<number, number> = {};
    homeTeam.value.linescores?.forEach((ls, index) => {
        scores[index + 1] = ls.value;
    });
    return scores;
});
</script>
