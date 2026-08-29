<template>
    <div class="box-score-view min-h-screen bg-background">
        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center min-h-[50vh]">
            <div class="text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p class="text-muted-foreground">Loading game data...</p>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex items-center justify-center min-h-[50vh]">
            <div class="text-center max-w-[31.25rem] mx-auto p-6">
                <p class="text-destructive text-lg font-semibold mb-2">{{ error }}</p>
                <Button @click="() => fetchGameSummary()" variant="outline" class="mt-4">
                    Try Again
                </Button>
                <Button @click="() => router.push('/scores')" variant="ghost" class="mt-2 ml-2">
                    Back to Scores
                </Button>
            </div>
        </div>

        <!-- Game Content -->
        <PageShell v-else-if="gameSummary" width="narrow">
            <!-- Game Header -->
            <GameHeader
                :game-summary="gameSummary"
                :is-live="isLive"
                @back="() => router.push('/scores')"
            />

            <!-- Quarter Scores -->
            <QuarterScores
                v-if="gameSummary.header?.competitions?.[0]?.competitors"
                :competitors="gameSummary.header.competitions[0].competitors"
                class="mt-2"
            />

            <!-- Tabs Navigation -->
            <Tabs default-value="box-score" class="mt-2">
                <TabsList class="grid w-full grid-cols-4 h-auto bg-muted/30 p-1 gap-0.5 border-b border-b-primary/10">
                    <TabsTrigger value="box-score" class="font-medium hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold text-[0.85rem] pt-2 pb-2 text-foreground/60">Box Score</TabsTrigger>
                    <TabsTrigger value="play-by-play" class="font-medium hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold text-[0.85rem] pt-2 pb-2 text-foreground/60">Play-by-Play</TabsTrigger>
                    <TabsTrigger value="team-stats" class="font-medium hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold text-[0.85rem] pt-2 pb-2 text-foreground/60">Team Stats</TabsTrigger>
                    <TabsTrigger value="advanced" class="font-medium hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold text-[0.85rem] pt-2 pb-2 text-foreground/60">Advanced</TabsTrigger>
                </TabsList>

                <!-- Box Score Tab -->
                <TabsContent value="box-score" class="mt-2">
                    <!-- Game Leaders -->
                    <GameLeaders
                        v-if="gameSummary.boxscore?.players"
                        :players="gameSummary.boxscore.players"
                        :leaders="gameSummary.leaders"
                        class="mb-2"
                    />

                    <!-- Player Stats Tables -->
                    <div v-if="gameSummary.boxscore?.players" class="space-y-2">
                        <div
                            v-for="(teamPlayers, index) in gameSummary.boxscore.players"
                            :key="teamPlayers.team.id"
                            class="player-stats-section"
                        >
                            <PlayerStatsTable
                                v-if="teamPlayers.statistics?.[0]?.names"
                                :team="teamPlayers.team"
                                :statistics="teamPlayers.statistics[0]"
                                :is-away-team="index === 0"
                            />
                            <div v-else class="text-center py-8 text-muted-foreground">
                                <p>Statistics not available for {{ teamPlayers.team.displayName }}</p>
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-center py-12 text-muted-foreground">
                        <p>Player statistics not yet available</p>
                    </div>
                </TabsContent>

                <!-- Play-by-Play Tab -->
                <TabsContent value="play-by-play" class="mt-4">
                    <PlayByPlay
                        v-if="gameSummary.plays && gameSummary.plays.length > 0"
                        :plays="gameSummary.plays"
                        :competitors="gameSummary.header?.competitions?.[0]?.competitors || []"
                    />
                    <div v-else class="text-center py-12 text-muted-foreground">
                        <p>Play-by-play not available for this game</p>
                    </div>
                </TabsContent>

                <!-- Team Stats Tab -->
                <TabsContent value="team-stats" class="mt-4">
                    <TeamStatsComparison
                        v-if="gameSummary.boxscore?.teams"
                        :teams="gameSummary.boxscore.teams"
                    />
                    <div v-else class="text-center py-12 text-muted-foreground">
                        <p>Team statistics not yet available</p>
                    </div>
                </TabsContent>

                <!-- Advanced Stats Tab -->
                <TabsContent value="advanced" class="mt-4">
                    <AdvancedStats
                        v-if="gameSummary.boxscore"
                        :boxscore="gameSummary.boxscore"
                        :win-probability="gameSummary.winprobability"
                    />
                    <div v-else class="text-center py-12 text-muted-foreground">
                        <p>Advanced statistics not yet available</p>
                    </div>
                </TabsContent>
            </Tabs>
        </PageShell>
    </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useGameSummary } from '@/composables/useGameSummary';
import PageShell from '@/layouts/PageShell.vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import GameHeader from '@/components/BoxScore/GameHeader.vue';
import QuarterScores from '@/components/BoxScore/QuarterScores.vue';
import PlayerStatsTable from '@/components/BoxScore/PlayerStatsTable.vue';
import GameLeaders from '@/components/BoxScore/GameLeaders.vue';
import TeamStatsComparison from '@/components/BoxScore/TeamStatsComparison.vue';
import PlayByPlay from '@/components/BoxScore/PlayByPlay.vue';
import AdvancedStats from '@/components/BoxScore/AdvancedStats.vue';

const route = useRoute();
const router = useRouter();
const gameId = route.params.gameId as string;

const { gameSummary, loading, error, isLive, fetchGameSummary } = useGameSummary(gameId);
</script>

<style scoped>
.box-score-view {
    min-height: 100vh;
}

.player-stats-section {
    scroll-margin-top: 2rem;
}
</style>
