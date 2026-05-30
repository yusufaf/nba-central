<template>
    <div class="game-header">
        <!-- Back Button -->
        <Button @click="emit('back')" variant="ghost" class="mb-0.5rem text-0.75rem px-0.5rem py-0.25rem h-auto">
            <ChevronLeft :size="14" class="mr-0.25rem" />
            Back to Scores
        </Button>

        <!-- Main Header Card -->
        <Card>
            <CardContent class="p-1.5rem" style="border-left: 3px solid hsl(var(--primary));">
                <div class="flex items-center justify-center" style="padding-left: 1.25rem;">
                    <!-- Away Team -->
                    <div class="flex items-center gap-0.75rem flex-1 justify-end">
                        <div class="flex flex-col text-right">
                            <span class="uppercase" style="font-size: 0.8rem; letter-spacing: 0.06em; color: hsl(var(--foreground) / 0.8);">{{ awayTeam.team.displayName }}</span>
                            <span v-if="awayTeamRecord" style="font-size: 0.75rem; color: hsl(var(--foreground) / 0.5);">{{ awayTeamRecord }}</span>
                        </div>
                        <div class="shrink-0" style="width: 3rem; height: 3rem;">
                            <img
                                :src="getTeamLogo('away')"
                                :alt="awayTeam.team.displayName"
                                class="w-full h-full object-contain"
                                style="border-radius: 8px;"
                            />
                        </div>
                    </div>

                    <!-- Score -->
                    <div class="flex flex-col items-center shrink-0" style="padding: 0 2rem;">
                        <div class="flex items-baseline" style="gap: 0.75rem;">
                            <span
                                class="font-extrabold tabular-nums"
                                :class="awayTeam.winner ? 'text-primary' : 'text-muted-foreground'"
                                style="font-size: 2.5rem; line-height: 1;"
                            >
                                {{ awayTeam.score || '0' }}
                            </span>
                            <span style="font-size: 1rem; color: #999; font-weight: 300; line-height: 1;">—</span>
                            <span
                                class="font-extrabold tabular-nums"
                                :class="homeTeam.winner ? 'text-primary' : 'text-muted-foreground'"
                                style="font-size: 2.5rem; line-height: 1;"
                            >
                                {{ homeTeam.score || '0' }}
                            </span>
                        </div>
                        <Badge
                            :variant="statusVariant"
                            :class="isLive ? 'bg-primary/15 text-primary border-transparent' : ''"
                            style="margin-top: 0.5rem; font-size: 0.7rem; padding: 0.2rem 0.65rem; font-weight: 600;"
                        >
                            {{ statusText }}
                        </Badge>
                    </div>

                    <!-- Home Team -->
                    <div class="flex items-center gap-0.75rem flex-1">
                        <div class="shrink-0" style="width: 3rem; height: 3rem;">
                            <img
                                :src="getTeamLogo('home')"
                                :alt="homeTeam.team.displayName"
                                class="w-full h-full object-contain"
                                style="border-radius: 8px;"
                            />
                        </div>
                        <div class="flex flex-col">
                            <span class="uppercase" style="font-size: 0.8rem; letter-spacing: 0.06em; color: hsl(var(--foreground) / 0.8);">{{ homeTeam.team.displayName }}</span>
                            <span v-if="homeTeamRecord" style="font-size: 0.75rem; color: hsl(var(--foreground) / 0.5);">{{ homeTeamRecord }}</span>
                        </div>
                    </div>
                </div>

                <!-- Game Info Footer -->
                <div
                    class="flex items-center justify-center flex-wrap"
                    style="margin-top: 0.75rem; padding-top: 0.6rem; border-top: 1px solid hsl(var(--primary) / 0.12); font-size: 0.75rem; gap: 0.5rem;"
                >
                    <span v-if="gameDate" class="flex items-center" style="color: hsl(var(--foreground) / 0.6); gap: 0.25rem;">
                        <Calendar :size="12" class="shrink-0" />
                        {{ gameDate }}
                    </span>
                    <span v-if="gameDate && venue" class="text-primary/30">·</span>
                    <span v-if="venue" class="flex items-center" style="color: hsl(var(--foreground) / 0.6); gap: 0.25rem;">
                        <MapPin :size="12" class="shrink-0" />
                        {{ venue }}
                    </span>
                    <span v-if="venue && broadcasts" class="text-primary/30">·</span>
                    <span v-if="broadcasts" class="flex items-center" style="color: hsl(var(--foreground) / 0.6); gap: 0.25rem;">
                        <Tv :size="12" class="shrink-0" />
                        {{ broadcasts }}
                    </span>
                </div>
            </CardContent>
        </Card>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, MapPin, Calendar, Tv } from 'lucide-vue-next';
import type { ESPNGameSummary } from '@/models/types';

interface Props {
    gameSummary: ESPNGameSummary;
    isLive: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    back: [];
}>();

const competition = computed(() => props.gameSummary.header?.competitions?.[0]);
const awayTeam = computed(() => competition.value?.competitors.find(c => c.homeAway === 'away')!);
const homeTeam = computed(() => competition.value?.competitors.find(c => c.homeAway === 'home')!);

const getTeamLogo = (homeAway: 'home' | 'away'): string => {
    const competitor = homeAway === 'home' ? homeTeam.value : awayTeam.value;
    if (competitor?.team?.logo) return competitor.team.logo;
    const boxscorePlayers = props.gameSummary.boxscore?.players;
    if (boxscorePlayers) {
        const idx = homeAway === 'away' ? 0 : 1;
        const fallback = boxscorePlayers[idx]?.team?.logo;
        if (fallback) return fallback;
    }
    return '';
};

const awayTeamRecord = computed(() => {
    const overall = awayTeam.value?.records?.find(r => r.type === 'total');
    return overall?.summary || null;
});

const homeTeamRecord = computed(() => {
    const overall = homeTeam.value?.records?.find(r => r.type === 'total');
    return overall?.summary || null;
});

const statusText = computed(() => {
    const status = competition.value?.status;
    if (!status) return 'Scheduled';
    if (status.type.state === 'pre') {
        return status.type.shortDetail || 'Scheduled';
    } else if (status.type.state === 'in') {
        return `${status.displayClock} - Q${status.period}`;
    } else {
        return status.type.detail || 'Final';
    }
});

const statusVariant = computed(() => {
    const state = competition.value?.status?.type?.state;
    if (state === 'in') return 'default';
    if (state === 'post') return 'secondary';
    return 'outline';
});

const venue = computed(() => {
    const venueInfo = competition.value?.venue || props.gameSummary.gameInfo?.venue;
    if (!venueInfo?.fullName) return null;
    const city = venueInfo.address?.city;
    const state = venueInfo.address?.state;
    const location = city && state ? ` (${city}, ${state})` : '';
    return `${venueInfo.fullName}${location}`;
});

const gameDate = computed(() => {
    const date = competition.value?.date;
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
});

const broadcasts = computed(() => {
    const topLevelBroadcasts = props.gameSummary.broadcasts;
    if (topLevelBroadcasts && topLevelBroadcasts.length > 0) {
        const result = topLevelBroadcasts
            .filter(b => b.names && Array.isArray(b.names))
            .map(b => b.names.join(', '))
            .filter(Boolean)
            .join(' • ');
        if (result) return result;
    }
    const competitionBroadcasts = competition.value?.broadcasts;
    if (competitionBroadcasts && competitionBroadcasts.length > 0) {
        const result = competitionBroadcasts
            .filter(b => b.media?.shortName)
            .map(b => b.media?.shortName)
            .filter(Boolean)
            .join(' • ');
        if (result) return result;
    }
    return null;
});
</script>

<style scoped>
.game-header {
    position: relative;
}
</style>
