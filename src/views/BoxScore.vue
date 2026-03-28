<template>
    <div class="box-score-view min-h-screen bg-background">
        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center min-h-[50vh]">
            <div class="text-center">
                <div class="animate-spin rounded-full h-2rem w-2rem border-b-0.125rem border-primary mx-auto mb-1rem"></div>
                <p class="text-muted-foreground">Loading game data...</p>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex items-center justify-center min-h-[50vh]">
            <div class="text-center max-w-[31.25rem] mx-auto p-1.5rem">
                <p class="text-destructive text-1.125rem font-semibold mb-0.5rem">{{ error }}</p>
                <Button @click="() => fetchGameSummary()" variant="outline" class="mt-1rem">
                    Try Again
                </Button>
                <Button @click="() => router.push('/scores')" variant="ghost" class="mt-0.5rem ml-0.5rem">
                    Back to Scores
                </Button>
            </div>
        </div>

        <!-- Game Content -->
        <div v-else-if="gameSummary" class="container mx-auto px-1rem py-1rem max-w-[75rem]">
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
                class="mt-0.5rem"
            />

            <!-- Tabs Navigation -->
            <Tabs default-value="box-score" class="mt-0.5rem">
                <TabsList class="grid w-full grid-cols-4 h-auto bg-muted/30 p-0.25rem gap-0.125rem" style="border-bottom: 1px solid hsl(var(--primary) / 0.1);">
                    <TabsTrigger value="box-score" class="text-0.75rem py-0.5rem font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold">Box Score</TabsTrigger>
                    <TabsTrigger value="play-by-play" class="text-0.75rem py-0.5rem font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold">Play-by-Play</TabsTrigger>
                    <TabsTrigger value="team-stats" class="text-0.75rem py-0.5rem font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold">Team Stats</TabsTrigger>
                    <TabsTrigger value="advanced" class="text-0.75rem py-0.5rem font-medium text-muted-foreground hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold">Advanced</TabsTrigger>
                </TabsList>

                <!-- Box Score Tab -->
                <TabsContent value="box-score" class="mt-0.5rem">
                    <!-- Game Leaders -->
                    <GameLeaders
                        v-if="gameSummary.boxscore?.players"
                        :players="gameSummary.boxscore.players"
                        :leaders="gameSummary.leaders"
                        class="mb-0.5rem"
                    />

                    <!-- Player Stats Tables -->
                    <div v-if="gameSummary.boxscore?.players" class="space-y-0.5rem">
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
                            <div v-else class="text-center py-2rem text-muted-foreground">
                                <p>Statistics not available for {{ teamPlayers.team.displayName }}</p>
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-center py-3rem text-muted-foreground">
                        <p>Player statistics not yet available</p>
                    </div>
                </TabsContent>

                <!-- Play-by-Play Tab -->
                <TabsContent value="play-by-play" class="mt-1rem">
                    <PlayByPlay
                        v-if="gameSummary.plays && gameSummary.plays.length > 0"
                        :plays="gameSummary.plays"
                        :competitors="gameSummary.header?.competitions?.[0]?.competitors || []"
                    />
                    <div v-else class="text-center py-3rem text-muted-foreground">
                        <p>Play-by-play not available for this game</p>
                    </div>
                </TabsContent>

                <!-- Team Stats Tab -->
                <TabsContent value="team-stats" class="mt-1rem">
                    <TeamStatsComparison
                        v-if="gameSummary.boxscore?.teams"
                        :teams="gameSummary.boxscore.teams"
                    />
                    <div v-else class="text-center py-3rem text-muted-foreground">
                        <p>Team statistics not yet available</p>
                    </div>
                </TabsContent>

                <!-- Advanced Stats Tab -->
                <TabsContent value="advanced" class="mt-1rem">
                    <AdvancedStats
                        v-if="gameSummary.boxscore"
                        :boxscore="gameSummary.boxscore"
                        :win-probability="gameSummary.winprobability"
                    />
                    <div v-else class="text-center py-3rem text-muted-foreground">
                        <p>Advanced statistics not yet available</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useGameSummary } from '@/composables/useGameSummary';
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
