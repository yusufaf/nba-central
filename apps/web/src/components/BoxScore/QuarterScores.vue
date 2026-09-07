<template>
    <Card v-if="awayTeam && homeTeam && hasLineScores">
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
                                    v-if="awayLogo"
                                    :src="awayLogo"
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
                            :class="{ 'bg-primary/10 font-semibold': Number(awayPeriodScores[period.period]) > Number(homePeriodScores[period.period]) }"
                        >
                            {{ awayPeriodScores[period.period] }}
                        </TableCell>
                        <TableCell
                            class="text-center font-bold text-lg py-[0.35rem] tabular-nums"
                            :class="awayIsWinner ? 'text-primary' : ''"
                        >
                            {{ awayTeam.score }}
                        </TableCell>
                    </TableRow>

                    <!-- Home Team Row -->
                    <TableRow>
                        <TableCell class="font-semibold text-sm py-[0.35rem]">
                            <div class="flex items-center gap-2">
                                <img
                                    v-if="homeLogo"
                                    :src="homeLogo"
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
                            :class="{ 'bg-primary/10 font-semibold': Number(homePeriodScores[period.period]) > Number(awayPeriodScores[period.period]) }"
                        >
                            {{ homePeriodScores[period.period] }}
                        </TableCell>
                        <TableCell
                            class="text-center font-bold text-lg py-[0.35rem] tabular-nums"
                            :class="homeIsWinner ? 'text-primary' : ''"
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
import type { ESPNCompetitor, ESPNTeamPlayers } from '@/models/types';
import { periodScore, isWinningTeam } from '@/utils/lineScore';
import { getTeamLogo } from '@/utils/teamLogo';

interface Props {
    competitors: ESPNCompetitor[];
    // The summary endpoint's competitors carry a null team.logo (they use a
    // logos[] array instead) - boxscore.players has a real one for the same
    // team, so getTeamLogo() falls back to it when this is passed.
    players?: ESPNTeamPlayers[];
}

const props = defineProps<Props>();

const awayTeam = computed(() => props.competitors.find(c => c.homeAway === 'away'));
const homeTeam = computed(() => props.competitors.find(c => c.homeAway === 'home'));

const awayLogo = computed(() => awayTeam.value ? getTeamLogo(awayTeam.value, 'away', props.players) : '');
const homeLogo = computed(() => homeTeam.value ? getTeamLogo(homeTeam.value, 'home', props.players) : '');

const awayIsWinner = computed(() => awayTeam.value ? isWinningTeam(awayTeam.value, homeTeam.value) : false);
const homeIsWinner = computed(() => homeTeam.value ? isWinningTeam(homeTeam.value, awayTeam.value) : false);

// Check if we have any line scores to display
const hasLineScores = computed(() => {
    if (!awayTeam.value || !homeTeam.value) return false;
    const awayScores = awayTeam.value.linescores?.length || 0;
    const homeScores = homeTeam.value.linescores?.length || 0;
    return awayScores > 0 || homeScores > 0;
});

// Build period labels (Q1, Q2, Q3, Q4, OT, OT2, etc.)
const periods = computed(() => {
    const maxPeriods = Math.max(
        awayTeam.value?.linescores?.length || 0,
        homeTeam.value?.linescores?.length || 0
    );

    return Array.from({ length: maxPeriods }, (_, i) => {
        const period = i + 1;
        let label: string;

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

// Build score maps for easy lookup. periodScore() reads displayValue when
// value is absent - the summary endpoint (this component's data source)
// only ever sends displayValue.
const awayPeriodScores = computed(() => {
    const scores: Record<number, string> = {};
    awayTeam.value?.linescores?.forEach((ls, index) => {
        scores[index + 1] = periodScore(ls);
    });
    return scores;
});

const homePeriodScores = computed(() => {
    const scores: Record<number, string> = {};
    homeTeam.value?.linescores?.forEach((ls, index) => {
        scores[index + 1] = periodScore(ls);
    });
    return scores;
});
</script>
