<template>
    <div class="space-y-0.5rem">
        <!-- Plus/Minus Leaders -->
        <Card style="border-left: 3px solid hsl(var(--primary));">
            <CardHeader class="pb-0.25rem py-0.5rem">
                <h3 class="text-0.75rem font-bold">Plus/Minus Leaders</h3>
            </CardHeader>
            <CardContent class="p-0.5rem">
                <div class="grid grid-cols-2 gap-0.5rem">
                    <!-- Positive Leaders -->
                    <div>
                        <h4 class="text-0.625rem font-semibold text-green-600 dark:text-green-400 mb-0.25rem">Top +/-</h4>
                        <div class="space-y-0.125rem">
                            <div
                                v-for="leader in topPlusMinus"
                                :key="leader.id"
                                class="flex items-center justify-between p-0.25rem rounded hover:bg-muted/50 text-0.625rem"
                            >
                                <span class="font-medium truncate">{{ leader.name }}</span>
                                <span class="text-green-600 dark:text-green-400 font-bold shrink-0">+{{ leader.value }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Negative Leaders -->
                    <div>
                        <h4 class="text-0.625rem font-semibold text-red-600 dark:text-red-400 mb-0.25rem">Bottom +/-</h4>
                        <div class="space-y-0.125rem">
                            <div
                                v-for="leader in bottomPlusMinus"
                                :key="leader.id"
                                class="flex items-center justify-between p-0.25rem rounded hover:bg-muted/50 text-0.625rem"
                            >
                                <span class="font-medium truncate">{{ leader.name }}</span>
                                <span class="text-red-600 dark:text-red-400 font-bold shrink-0">{{ leader.value }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Shooting Efficiency -->
        <Card style="border-left: 3px solid hsl(var(--primary));">
            <CardHeader class="pb-0.25rem py-0.5rem">
                <h3 class="text-0.75rem font-bold">Shooting Efficiency</h3>
            </CardHeader>
            <CardContent class="p-0.5rem">
                <div class="grid grid-cols-2 gap-0.5rem">
                    <div v-for="team in boxscore.players" :key="team.team.id">
                        <h4 class="text-0.625rem font-semibold mb-0.25rem flex items-center gap-0.25rem">
                            <img :src="team.team.logo" :alt="team.team.abbreviation" style="width: 1rem; height: 1rem;" class="object-contain shrink-0" />
                            {{ team.team.displayName }}
                        </h4>
                        <div class="space-y-0.125rem">
                            <div
                                v-for="player in getTopShooters(team)"
                                :key="player.id"
                                class="flex items-center justify-between text-0.625rem"
                            >
                                <span class="truncate">{{ player.name }}</span>
                                <span class="font-mono shrink-0 ml-0.25rem">
                                    {{ player.fg }} FG ({{ player.fgPct }}%)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Bench Production -->
        <Card style="border-left: 3px solid hsl(var(--primary));">
            <CardHeader class="pb-0.25rem py-0.5rem">
                <h3 class="text-0.75rem font-bold">Bench Production</h3>
            </CardHeader>
            <CardContent class="p-0.5rem">
                <div class="space-y-0.5rem">
                    <div v-for="team in boxscore.players" :key="team.team.id">
                        <div class="flex items-center justify-between mb-0.25rem">
                            <div class="flex items-center gap-0.25rem">
                                <img :src="team.team.logo" :alt="team.team.abbreviation" style="width: 1rem; height: 1rem;" class="object-contain shrink-0" />
                                <span class="font-semibold text-0.625rem">{{ team.team.displayName }}</span>
                            </div>
                            <span class="text-0.875rem font-bold text-primary">
                                {{ getBenchPoints(team) }} pts
                            </span>
                        </div>
                        <div class="grid grid-cols-3 gap-0.5rem text-center text-0.625rem">
                            <div>
                                <p class="text-muted-foreground">Rebounds</p>
                                <p class="font-semibold">{{ getBenchStat(team, 5) }}</p>
                            </div>
                            <div>
                                <p class="text-muted-foreground">Assists</p>
                                <p class="font-semibold">{{ getBenchStat(team, 6) }}</p>
                            </div>
                            <div>
                                <p class="text-muted-foreground">FG%</p>
                                <p class="font-semibold">{{ getBenchFgPct(team) }}%</p>
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

const getBenchStat = (team: any, statIndex: number) => {
    const stats = team.statistics?.[0];
    if (!stats?.athletes) return 0;

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
