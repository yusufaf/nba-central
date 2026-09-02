<template>
    <div class="game-header">
        <!-- Back Button -->
        <Button @click="emit('back')" variant="ghost" class="mb-2 text-xs px-2 py-1 h-auto">
            <ChevronLeft :size="14" class="mr-1" />
            Back to Scores
        </Button>

        <!-- Main Header Card -->
        <Card>
            <CardContent class="p-6 border-l-[0.1875rem] border-l-primary">
                <div class="flex items-center justify-center pl-5" v-if="awayTeam && homeTeam">
                    <!-- Away Team -->
                    <div class="flex items-center gap-3 flex-1 justify-end">
                        <div class="flex flex-col text-right">
                            <span class="uppercase text-[0.8rem] tracking-[0.06em] text-foreground/80">{{ awayTeam.team.displayName }}</span>
                            <span class="text-xs text-foreground/50" v-if="awayTeamRecord">{{ awayTeamRecord }}</span>
                        </div>
                        <div class="shrink-0 w-12 h-12">
                            <img
                                :src="getTeamLogo('away')"
                                :alt="awayTeam.team.displayName"
                                class="w-full h-full object-contain rounded-lg"
                            />
                        </div>
                    </div>

                    <!-- Score -->
                    <div class="flex flex-col items-center shrink-0 px-8 py-0">
                        <div class="flex items-baseline gap-3">
                            <span
                                class="font-extrabold tabular-nums text-[2.5rem] leading-none"
                                :class="awayTeam.winner ? 'text-primary' : 'text-muted-foreground'"
                            >
                                {{ awayTeam.score || '0' }}
                            </span>
                            <span class="text-base text-muted-foreground font-light leading-none">—</span>
                            <span
                                class="font-extrabold tabular-nums text-[2.5rem] leading-none"
                                :class="homeTeam.winner ? 'text-primary' : 'text-muted-foreground'"
                            >
                                {{ homeTeam.score || '0' }}
                            </span>
                        </div>
                        <Badge class="mt-2 text-[0.7rem] px-[0.65rem] py-[0.2rem] font-semibold"
                            :variant="statusVariant"
                            :class="isLive ? 'bg-primary/15 text-primary border-transparent' : ''"
                        >
                            {{ statusText }}
                        </Badge>
                    </div>

                    <!-- Home Team -->
                    <div class="flex items-center gap-3 flex-1">
                        <div class="shrink-0 w-12 h-12">
                            <img
                                :src="getTeamLogo('home')"
                                :alt="homeTeam.team.displayName"
                                class="w-full h-full object-contain rounded-lg"
                            />
                        </div>
                        <div class="flex flex-col">
                            <span class="uppercase text-[0.8rem] tracking-[0.06em] text-foreground/80">{{ homeTeam.team.displayName }}</span>
                            <span class="text-xs text-foreground/50" v-if="homeTeamRecord">{{ homeTeamRecord }}</span>
                        </div>
                    </div>
                </div>

                <!-- Game Info Footer -->
                <div
                    class="flex items-center justify-center flex-wrap mt-3 pt-[0.6rem] border-t border-t-primary/[0.12] text-xs gap-2"
                >
                    <span v-if="gameDate" class="flex items-center text-foreground/60 gap-1">
                        <Calendar :size="12" class="shrink-0" />
                        {{ gameDate }}
                    </span>
                    <span v-if="gameDate && venue" class="text-primary/30">·</span>
                    <span v-if="venue" class="flex items-center text-foreground/60 gap-1">
                        <MapPin :size="12" class="shrink-0" />
                        {{ venue }}
                    </span>
                    <span v-if="venue && broadcasts" class="text-primary/30">·</span>
                    <span v-if="broadcasts" class="flex items-center text-foreground/60 gap-1">
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
const awayTeam = computed(() => competition.value?.competitors.find(c => c.homeAway === 'away'));
const homeTeam = computed(() => competition.value?.competitors.find(c => c.homeAway === 'home'));

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
