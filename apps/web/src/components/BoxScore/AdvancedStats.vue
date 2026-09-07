<template>
    <div class="space-y-2">
        <!-- Plus/Minus Leaders -->
        <Card>
            <CardHeader class="pb-1 py-2">
                <SectionHeading>Plus/Minus Leaders</SectionHeading>
            </CardHeader>
            <CardContent class="p-3">
                <div class="grid grid-cols-2 gap-3">
                    <!-- Positive Leaders -->
                    <div>
                        <h4 class="font-bold text-success mb-1 text-[0.6875rem] uppercase tracking-[0.06em]">Top +/-</h4>
                        <div class="space-y-0.5">
                            <div
                                v-for="leader in topPlusMinus"
                                :key="leader.id"
                                class="flex items-center justify-between rounded hover:bg-muted/50 p-1 text-[0.9375rem]"
                            >
                                <span class="font-medium truncate">{{ leader.name }}</span>
                                <span class="text-success font-bold shrink-0 tabular-nums">+{{ leader.value }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Negative Leaders -->
                    <div>
                        <h4 class="font-bold text-destructive mb-1 text-[0.6875rem] uppercase tracking-[0.06em]">Bottom +/-</h4>
                        <div class="space-y-0.5">
                            <div
                                v-for="leader in bottomPlusMinus"
                                :key="leader.id"
                                class="flex items-center justify-between rounded hover:bg-muted/50 p-1 text-[0.9375rem]"
                            >
                                <span class="font-medium truncate">{{ leader.name }}</span>
                                <span class="text-destructive font-bold shrink-0 tabular-nums">{{ leader.value }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Shooting Efficiency -->
        <Card>
            <CardHeader class="pb-1 py-2">
                <SectionHeading>Shooting Efficiency</SectionHeading>
            </CardHeader>
            <CardContent class="p-3">
                <div class="grid grid-cols-2 gap-3">
                    <div v-for="team in boxscore.players" :key="team.team.id">
                        <h4 class="font-semibold mb-1 flex items-center gap-1.5 text-[0.8125rem]">
                            <img :src="team.team.logo" :alt="team.team.abbreviation" class="object-contain shrink-0 w-4 h-4" />
                            {{ team.team.displayName }}
                        </h4>
                        <div class="space-y-0.5">
                            <div
                                v-for="player in getTopShooters(team)"
                                :key="player.id"
                                class="flex items-center justify-between text-[0.8125rem]"
                            >
                                <span class="truncate">{{ player.name }}</span>
                                <span class="font-mono shrink-0 ml-1 tabular-nums">
                                    {{ player.fg }} FG ({{ player.fgPct }}%)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Bench Production -->
        <Card>
            <CardHeader class="pb-1 py-2">
                <SectionHeading>Bench Production</SectionHeading>
            </CardHeader>
            <CardContent class="p-3">
                <div class="space-y-3">
                    <div v-for="team in boxscore.players" :key="team.team.id">
                        <div class="flex items-center justify-between mb-1">
                            <div class="flex items-center gap-1.5">
                                <img :src="team.team.logo" :alt="team.team.abbreviation" class="object-contain shrink-0 w-4 h-4" />
                                <span class="font-semibold text-[0.8125rem]">{{ team.team.displayName }}</span>
                            </div>
                            <span class="font-bold text-primary text-[0.9375rem] tabular-nums">
                                {{ getBenchPoints(team) }} pts
                            </span>
                        </div>
                        <div class="grid grid-cols-3 text-center gap-2 text-[0.8125rem]">
                            <div>
                                <p class="text-foreground/50">Rebounds</p>
                                <p class="font-semibold tabular-nums">{{ getBenchStat(team, 'REB') }}</p>
                            </div>
                            <div>
                                <p class="text-foreground/50">Assists</p>
                                <p class="font-semibold tabular-nums">{{ getBenchStat(team, 'AST') }}</p>
                            </div>
                            <div>
                                <p class="text-foreground/50">FG%</p>
                                <p class="font-semibold tabular-nums">{{ getBenchFgPct(team) }}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import SectionHeading from '@/components/layout/SectionHeading.vue';
import type { ESPNGameSummary } from '@/models/types';

interface Props {
    boxscore: NonNullable<ESPNGameSummary['boxscore']>;
    winProbability?: ESPNGameSummary['winprobability'];
}

const props = defineProps<Props>();

const topPlusMinus = computed(() => {
    const players: Array<{ id: string; name: string; value: number }> = [];

    props.boxscore.players.forEach(team => {
        const stats = team.statistics?.[0];
        if (!stats?.names || !stats?.athletes) return;

        stats.athletes
            .filter(p => !p.didNotPlay)
            .forEach(player => {
                const plusMinusIndex = stats.names.indexOf('+/-');
                if (plusMinusIndex === -1) return;

                const value = parseInt(player.stats[plusMinusIndex]) || 0;
                players.push({
                    id: player.athlete.id,
                    name: player.athlete.displayName,
                    value,
                });
            });
    });

    return players.filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
});

const bottomPlusMinus = computed(() => {
    const players: Array<{ id: string; name: string; value: number }> = [];

    props.boxscore.players.forEach(team => {
        const stats = team.statistics?.[0];
        if (!stats?.names || !stats?.athletes) return;

        stats.athletes
            .filter(p => !p.didNotPlay)
            .forEach(player => {
                const plusMinusIndex = stats.names.indexOf('+/-');
                if (plusMinusIndex === -1) return;

                const value = parseInt(player.stats[plusMinusIndex]) || 0;
                players.push({
                    id: player.athlete.id,
                    name: player.athlete.displayName,
                    value,
                });
            });
    });

    return players.filter(p => p.value < 0).sort((a, b) => a.value - b.value).slice(0, 5);
});

const getTopShooters = (team: any) => {
    const stats = team.statistics?.[0];
    if (!stats?.names || !stats?.athletes) return [];

    const players = stats.athletes.filter((p: any) => !p.didNotPlay) || [];
    const fgIndex = stats.names.indexOf('FG');
    if (fgIndex === -1) return [];

    return players
        .map((player: any) => {
            const fg = player.stats[fgIndex];
            if (!fg || fg === '-') return null;

            const [made, attempted] = fg.split('-').map(Number);
            const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0;

            return {
                id: player.athlete.id,
                name: player.athlete.displayName,
                fg,
                fgPct: pct,
                made,
            };
        })
        .filter((p: any) => p && p.made >= 5)
        .sort((a: any, b: any) => b.fgPct - a.fgPct)
        .slice(0, 5);
};

const getBenchPoints = (team: any) => {
    const stats = team.statistics?.[0];
    if (!stats?.names || !stats?.athletes) return 0;

    const ptsIndex = stats.names.indexOf('PTS');
    if (ptsIndex === -1) return 0;

    return stats.athletes
        .filter((p: any) => !p.starter && !p.didNotPlay)
        .reduce((sum: number, p: any) => sum + (parseInt(p.stats[ptsIndex]) || 0), 0) || 0;
};

const getBenchStat = (team: any, statName: string) => {
    const stats = team.statistics?.[0];
    if (!stats?.names || !stats?.athletes) return 0;

    const statIndex = stats.names.indexOf(statName);
    if (statIndex === -1) return 0;

    return stats.athletes
        .filter((p: any) => !p.starter && !p.didNotPlay)
        .reduce((sum: number, p: any) => sum + (parseInt(p.stats[statIndex]) || 0), 0) || 0;
};

const getBenchFgPct = (team: any) => {
    const stats = team.statistics?.[0];
    if (!stats?.names || !stats?.athletes) return 0;

    const fgIndex = stats.names.indexOf('FG');
    if (fgIndex === -1) return 0;

    const benchPlayers = stats.athletes.filter((p: any) => !p.starter && !p.didNotPlay) || [];

    let totalMade = 0;
    let totalAttempted = 0;

    benchPlayers.forEach((player: any) => {
        const fg = player.stats[fgIndex];
        if (!fg || fg === '-') return;

        const [made, attempted] = fg.split('-').map(Number);
        totalMade += made;
        totalAttempted += attempted;
    });

    return totalAttempted > 0 ? Math.round((totalMade / totalAttempted) * 100) : 0;
};
</script>
