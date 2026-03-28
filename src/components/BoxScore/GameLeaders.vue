<template>
    <Card style="border-left: 3px solid hsl(var(--primary));">
        <CardHeader class="pb-0.25rem py-0.5rem">
            <h3 class="text-0.75rem font-semibold">Game Leaders</h3>
        </CardHeader>
        <CardContent class="p-0.75rem">
            <div class="grid grid-cols-3 gap-1rem">
                <!-- Points Leaders -->
                <div v-if="pointsLeaders.length > 0">
                    <h4
                        class="text-muted-foreground uppercase mb-0.25rem tracking-wide"
                        style="font-size: 0.6rem; font-weight: 600;"
                    >Points</h4>
                    <div class="space-y-0.375rem">
                        <div
                            v-for="leader in pointsLeaders.slice(0, 3)"
                            :key="leader.athlete.id"
                            class="flex items-center gap-0.375rem"
                        >
                            <img
                                v-if="leader.athlete.headshot?.href"
                                :src="leader.athlete.headshot.href"
                                :alt="leader.athlete.displayName"
                                style="width: 1.75rem; height: 1.75rem;"
                                class="rounded-full object-cover shrink-0"
                            />
                            <div class="flex-1 min-w-0">
                                <p class="font-medium truncate leading-tight" style="font-size: 0.7rem;">{{ leader.athlete.displayName }}</p>
                                <p class="text-muted-foreground leading-tight" style="font-size: 0.55rem;">
                                    {{ getTeamAbbr(leader.team.id) }}
                                </p>
                            </div>
                            <div class="text-primary shrink-0 font-bold" style="font-size: 0.875rem;">
                                {{ leader.displayValue }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Rebounds Leaders -->
                <div v-if="reboundsLeaders.length > 0">
                    <h4
                        class="text-muted-foreground uppercase mb-0.25rem tracking-wide"
                        style="font-size: 0.6rem; font-weight: 600;"
                    >Rebounds</h4>
                    <div class="space-y-0.375rem">
                        <div
                            v-for="leader in reboundsLeaders.slice(0, 3)"
                            :key="leader.athlete.id"
                            class="flex items-center gap-0.375rem"
                        >
                            <img
                                v-if="leader.athlete.headshot?.href"
                                :src="leader.athlete.headshot.href"
                                :alt="leader.athlete.displayName"
                                style="width: 1.75rem; height: 1.75rem;"
                                class="rounded-full object-cover shrink-0"
                            />
                            <div class="flex-1 min-w-0">
                                <p class="font-medium truncate leading-tight" style="font-size: 0.7rem;">{{ leader.athlete.displayName }}</p>
                                <p class="text-muted-foreground leading-tight" style="font-size: 0.55rem;">
                                    {{ getTeamAbbr(leader.team.id) }}
                                </p>
                            </div>
                            <div class="text-primary shrink-0 font-bold" style="font-size: 0.875rem;">
                                {{ leader.displayValue }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Assists Leaders -->
                <div v-if="assistsLeaders.length > 0">
                    <h4
                        class="text-muted-foreground uppercase mb-0.25rem tracking-wide"
                        style="font-size: 0.6rem; font-weight: 600;"
                    >Assists</h4>
                    <div class="space-y-0.375rem">
                        <div
                            v-for="leader in assistsLeaders.slice(0, 3)"
                            :key="leader.athlete.id"
                            class="flex items-center gap-0.375rem"
                        >
                            <img
                                v-if="leader.athlete.headshot?.href"
                                :src="leader.athlete.headshot.href"
                                :alt="leader.athlete.displayName"
                                style="width: 1.75rem; height: 1.75rem;"
                                class="rounded-full object-cover shrink-0"
                            />
                            <div class="flex-1 min-w-0">
                                <p class="font-medium truncate leading-tight" style="font-size: 0.7rem;">{{ leader.athlete.displayName }}</p>
                                <p class="text-muted-foreground leading-tight" style="font-size: 0.55rem;">
                                    {{ getTeamAbbr(leader.team.id) }}
                                </p>
                            </div>
                            <div class="text-primary shrink-0 font-bold" style="font-size: 0.875rem;">
                                {{ leader.displayValue }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { ESPNTeamPlayers, ESPNLeader, ESPNLeaderItem } from '@/models/types';

interface Props {
    players: ESPNTeamPlayers[];
    leaders?: ESPNLeader[][];
}

const props = defineProps<Props>();

// Extract leaders from boxscore players data
const pointsLeaders = computed(() => {
    return getLeadersByStatIndex(1); // PTS is typically index 1
});

const reboundsLeaders = computed(() => {
    return getLeadersByStatIndex(5); // REB is typically index 5
});

const assistsLeaders = computed(() => {
    return getLeadersByStatIndex(6); // AST is typically index 6
});

const getLeadersByStatIndex = (statIndex: number): ESPNLeaderItem[] => {
    const leaders: ESPNLeaderItem[] = [];

    props.players.forEach(teamPlayers => {
        if (!teamPlayers.statistics?.[0]?.athletes) return;

        teamPlayers.statistics[0].athletes
            .filter(p => !p.didNotPlay)
            .forEach(player => {
                const statValue = player.stats[statIndex];
                if (!statValue || statValue === '-' || statValue === '0') return;

                leaders.push({
                    athlete: player.athlete,
                    team: { id: teamPlayers.team.id },
                    displayValue: statValue,
                    value: parseFloat(statValue) || 0,
                });
            });
    });

    return leaders.sort((a, b) => b.value - a.value);
};

const getTeamAbbr = (teamId: string): string => {
    const team = props.players.find(tp => tp.team.id === teamId);
    return team?.team.abbreviation || '';
};
</script>
