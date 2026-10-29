<template>
    <Card v-if="visible">
        <CardHeader class="pb-1 py-2">
            <SectionHeading>Win Probability Added</SectionHeading>
        </CardHeader>
        <CardContent class="p-3 space-y-3">
            <div v-if="final && (mvp || lvp)" class="grid grid-cols-2 gap-3">
                <div v-if="mvp" data-testid="wpa-mvp" class="rounded-md bg-muted/50 p-2">
                    <p class="font-bold text-success text-[0.6875rem] uppercase tracking-[0.06em]">Game MVP</p>
                    <p class="font-medium truncate text-[0.9375rem]">{{ nameOf(mvp.athleteId) }}</p>
                    <p class="text-[0.8125rem] tabular-nums">
                        <span class="text-foreground/60">{{ teamOf(mvp.side).abbreviation }}</span>
                        <span class="font-bold text-success ml-1">{{ formatDelta(mvp.wpa) }}</span>
                    </p>
                </div>
                <div v-if="lvp" data-testid="wpa-lvp" class="rounded-md bg-muted/50 p-2">
                    <p class="font-bold text-destructive-strong text-[0.6875rem] uppercase tracking-[0.06em]">Game LVP</p>
                    <p class="font-medium truncate text-[0.9375rem]">{{ nameOf(lvp.athleteId) }}</p>
                    <p class="text-[0.8125rem] tabular-nums">
                        <span class="text-foreground/60">{{ teamOf(lvp.side).abbreviation }}</span>
                        <span class="font-bold text-destructive-strong ml-1">{{ formatDelta(lvp.wpa) }}</span>
                    </p>
                </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 text-[0.8125rem]">
                <div data-testid="wpa-excitement">
                    <p class="text-foreground/50">Excitement</p>
                    <p class="font-bold text-[0.9375rem] tabular-nums">{{ excitementIndex.toFixed(1) }}</p>
                    <p class="text-foreground/60 text-[0.6875rem]">
                        Total win probability movement.<template v-if="final"> A typical game measures about 7.6.</template>
                    </p>
                </div>
                <div v-if="final && comebackText" data-testid="wpa-comeback">
                    <p class="text-foreground/50">Comeback</p>
                    <p class="font-semibold">{{ comebackText }}</p>
                </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
                <div v-for="team in teams" :key="team.side" data-testid="wpa-team">
                    <h4 class="font-semibold mb-1 flex items-center gap-1.5 text-[0.8125rem]">
                        <img v-if="team.logo" :src="team.logo" :alt="team.abbreviation" class="object-contain shrink-0 w-4 h-4" />
                        {{ team.displayName }}
                    </h4>
                    <div class="space-y-0.5">
                        <div
                            v-for="row in team.rows"
                            :key="row.athleteId"
                            data-testid="wpa-row"
                            class="flex items-center justify-between text-[0.8125rem]"
                        >
                            <span class="truncate">{{ nameOf(row.athleteId) }}</span>
                            <span
                                class="font-semibold shrink-0 ml-1 tabular-nums"
                                :class="row.wpa >= 0 ? 'text-success' : 'text-destructive-strong'"
                            >{{ formatDelta(row.wpa) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <p class="text-[0.6875rem] text-foreground/60">
                Credit goes to the player who shot, turned the ball over or rebounded, and a foul's swing goes to the
                player it sends to the free-throw line. Assists, steals, blocks, fouls with no free throws, team
                rebounds, team turnovers, timeouts, substitutions and reviews go to no one, so a team's players don't
                add up to its total.
                Win probability: ESPN Analytics.
            </p>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import SectionHeading from '@/components/layout/SectionHeading.vue';
import type { ESPNCompetitor, ESPNTeamPlayers } from '@/models/types';
import { getTeamLogo } from '@/utils/teamLogo';
import {
    comeback,
    excitement,
    formatDelta,
    formatWp,
    playerWpa,
    type WpPoint,
    type WpSide,
} from '@/utils/winProbability';

const props = defineProps<{
    series: WpPoint[];
    players: ESPNTeamPlayers[];
    competitors: ESPNCompetitor[];
    final: boolean;
}>();

const rows = computed(() => playerWpa(props.series));
const visible = computed(() => props.series.length >= 2 && rows.value.length > 0);

const names = computed(() => {
    const map = new Map<string, string>();
    for (const team of props.players) {
        for (const entry of team.statistics?.[0]?.athletes ?? []) {
            map.set(entry.athlete.id, entry.athlete.displayName);
        }
    }
    return map;
});
const nameOf = (athleteId: string) => names.value.get(athleteId) ?? 'Unknown player';

const teamOf = (side: WpSide) => {
    const competitor = props.competitors.find((c) => c.homeAway === side);
    return {
        side,
        abbreviation: competitor?.team.abbreviation ?? '',
        displayName: competitor?.team.displayName ?? '',
        logo: competitor ? getTeamLogo(competitor, side, props.players) : '',
    };
};

// Away first, as in the rest of the box score.
const teams = computed(() =>
    (['away', 'home'] as const).map((side) => ({
        ...teamOf(side),
        rows: rows.value.filter((row) => row.side === side),
    })),
);

const mvp = computed(() => {
    const top = rows.value[0];
    return top && top.wpa > 0 ? top : null;
});
const lvp = computed(() => {
    const bottom = rows.value.at(-1);
    return bottom && bottom.wpa < 0 ? bottom : null;
});

const excitementIndex = computed(() => excitement(props.series));

const comebackText = computed(() => {
    const result = comeback(props.series);
    if (!result) return null;
    const abbreviation = teamOf(result.side).abbreviation;
    return result.low < 0.5
        ? `${abbreviation} won after being down to ${formatWp(result.low)}`
        : `${abbreviation} never fell below ${formatWp(result.low)}`;
});
</script>
