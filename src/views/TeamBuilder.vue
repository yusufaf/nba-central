<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { toast } from 'vue-sonner';
import axios from "axios";
import PageTitle from "@/components/PageTitle.vue";
import TeamBuilderHeader from "@/components/TeamBuilder/TeamBuilderHeader.vue";
import RosterSection from "@/components/TeamBuilder/RosterSection.vue";
import AddPlayerDialog from "@/components/TeamBuilder/AddPlayerDialog.vue";
import PlayerStatsDialog from "@/components/TeamBuilder/PlayerStatsDialog.vue";
import CoachSection from "@/components/TeamBuilder/CoachSection.vue";
import ArenaSection from "@/components/TeamBuilder/ArenaSection.vue";
import GMSection from "@/components/TeamBuilder/GMSection.vue";
import PlayerComparison from "@/components/TeamBuilder/PlayerComparison.vue";
import { dataApi } from "@/network/api";
import type { Team, DrawerSide, NBA2KRating } from "@/models/types";
import type { GetPlayerStatsResponse } from "@/models/api";

/* Team Metadata */
const teamName = ref<string>("");
const teamDescription = ref<string>("");
const teamCity = ref<string>("");
const teamCountry = ref<string>("");
const teamLogo = ref<string>("");
const teamScore = ref<number>(0);

const teamCoach = ref<any>(null);
const teamArena = ref<any>(null);
const teamGM = ref<any>(null);

const showPlayerDialog = ref<boolean>(false);
const showCoachDrawer = ref<boolean>(false);
const showArenaDrawer = ref<boolean>(false);
const showGMDrawer = ref<boolean>(false);

const selectedPlayerIndex = ref<number | null>(null);
const selectedPlayersData = ref<Map<any, any>>(new Map());
const selectedPlayerStats = ref<any>([]);
const selectedPlayerRatingHistory = ref<NBA2KRating[]>([]);
const selectedPlayerName = ref<string>("");

const cardsFlipped = ref<Map<any, boolean>>(new Map());
const showPlayerStatsDialog = ref<boolean>(false);

const selectedView = ref<string>("Default");
const selectedDrawerSide = ref<DrawerSide>("right");
const headerExpanded = ref<boolean>(false);

const selectedPlayersForComparison = ref<Set<any>>(new Set());
const showPlayerComparison = ref<boolean>(false);

const selectedComparePlayers = computed(() => {
    const comparePlayers = [...selectedPlayersForComparison.value];
    return comparePlayers.slice(0, 2);
});

// The full player objects - each carries its own playerStats array, which is
// what the comparison averages. Indexing anything by slot number here is a bug.
const comparisonPlayers = computed(() =>
    selectedComparePlayers.value.map((slotIndex) =>
        selectedPlayersData.value.get(slotIndex),
    ),
);

const playerCount = computed(() => selectedPlayersData.value.size);
const starterCount = computed(() => {
    let count = 0;
    for (let i = 1; i <= 5; i++) {
        if (selectedPlayersData.value.has(i)) count++;
    }
    return count;
});

const playerStatsData = computed(() => {
    return selectedPlayerStats.value.map((item: any, index: number) => {
        return {
            ...item,
            id: index,
        };
    });
});

// One request for the player's whole career (most recent season first) plus
// their NBA 2K rating history, which only this endpoint returns.
const getPlayerStats = async (
    playerId: string,
): Promise<GetPlayerStatsResponse> => {
    if (!playerId) return { data: [] };

    try {
        const response = await dataApi.getPlayerStats(playerId);
        return { ...response, data: response.data ?? [] };
    } catch (err) {
        console.error("Error fetching player stats: ", err);
        return { data: [] };
    }
};

const addPlayer = (index: number) => {
    selectedPlayerIndex.value = index;
    showPlayerDialog.value = true;
};

const addPlayerFromDialog = async (player: any) => {
    const playerIndex = selectedPlayerIndex.value;

    toast.promise(
        async () => {
            const { id } = player;
            const { data: playerStats, ratingHistory } =
                await getPlayerStats(id);
            const updatedPlayerData = { ...player, playerStats, ratingHistory };
            selectedPlayersData.value.set(playerIndex, updatedPlayerData);
            cardsFlipped.value.set(playerIndex, false);
        },
        {
            loading: 'Adding player...',
            success: `Added ${player.first_name} ${player.last_name} to your team`,
            error: 'Failed to add player',
        }
    );
};

const deletePlayer = (index: number) => {
    const player = selectedPlayersData.value.get(index);
    selectedPlayersData.value.delete(index);
    cardsFlipped.value.delete(index);
    selectedPlayersForComparison.value.delete(index);

    if (player) {
        toast.success(`Removed ${player.fullName} from team`);
    }
};

const flipCard = (n: number) => {
    const isFlipped = cardsFlipped.value.get(n);
    cardsFlipped.value.set(n, !isFlipped);
};

const viewPlayerStats = (index: number) => {
    selectedPlayerIndex.value = index;
    const player = selectedPlayersData.value.get(index);
    const modifiedPlayerStats = player.playerStats.map(
        (item: any, idx: number) => {
            return {
                ...item,
                id: idx,
            };
        },
    );

    selectedPlayerStats.value = modifiedPlayerStats;
    selectedPlayerRatingHistory.value = player.ratingHistory ?? [];
    selectedPlayerName.value = player.fullName ?? "";
    showPlayerStatsDialog.value = true;
};

const togglePlayerInComparison = (n: number) => {
    const isSelected = selectedPlayersForComparison.value.has(n);

    if (selectedPlayersForComparison.value.size === 2 && !isSelected) {
        toast.warning('You can only compare two players at a time');
        return;
    }

    const playerName = selectedPlayersData.value.get(n).fullName;
    if (isSelected) {
        selectedPlayersForComparison.value.delete(n);
        toast.info(`Removed ${playerName} from comparison`);
    } else {
        selectedPlayersForComparison.value.add(n);
        toast.info(`Added ${playerName} to comparison`);
    }

    // Two picked is the whole gesture - open the comparison rather than making
    // the user hunt for another control.
    if (selectedPlayersForComparison.value.size === 2) {
        showPlayerComparison.value = true;
    }
};

// Clear the picks on close, otherwise the pair is still selected and the dialog
// reopens the moment anything re-evaluates.
watch(showPlayerComparison, (open) => {
    if (!open) selectedPlayersForComparison.value.clear();
});

const resetTeam = () => {
    selectedPlayersData.value.clear();
    cardsFlipped.value.clear();
    selectedPlayersForComparison.value.clear();
    teamCoach.value = null;
    teamArena.value = null;
    teamGM.value = null;
    teamName.value = "";
    teamDescription.value = "";
    teamCity.value = "";
    teamCountry.value = "";
    teamLogo.value = "";

    toast.success('Team cleared successfully');
};

const saveTeam = () => {
    const uuid = crypto.randomUUID();

    const players = Array.from(selectedPlayersData.value.values()).map(
        (p) => p.fullName
    );

    const newTeam: Team = {
        uuid,
        description: teamDescription.value || "Custom NBA Team",
        name: teamName.value,
        players,
    };

    toast.promise(
        axios.post(`/api/team/`, newTeam),
        {
            loading: 'Saving team...',
            success: 'Team saved successfully!',
            error: 'Failed to save team',
        }
    );
};
</script>

<template>
    <main class="team-builder-page">
        <PageTitle />

        <div class="page-container">
            <!-- Team Builder Header -->
            <div class="header-card">
                <TeamBuilderHeader
                    v-model:headerExpanded="headerExpanded"
                    v-model:teamName="teamName"
                    v-model:teamDescription="teamDescription"
                    v-model:teamCity="teamCity"
                    v-model:teamCountry="teamCountry"
                    v-model:teamLogo="teamLogo"
                    v-model:drawerSide="selectedDrawerSide"
                    v-model:selectedView="selectedView"
                    @saveTeam="saveTeam"
                    @reset="resetTeam"
                />
            </div>

            <!-- Roster Section -->
            <RosterSection
                :selected-players="selectedPlayersData"
                :cards-flipped="cardsFlipped"
                @add-player="addPlayer"
                @remove-player="deletePlayer"
                @flip-card="flipCard"
                @view-stats="viewPlayerStats"
                @compare="togglePlayerInComparison"
            />

            <!-- Team Staff Section -->
            <div class="staff-section">
                <h2 class="section-title">Team Staff & Facilities</h2>
                <div class="staff-grid">
                    <CoachSection
                        v-model:teamCoach="teamCoach"
                        v-model:showCoachDrawer="showCoachDrawer"
                        :selectedDrawerSide="selectedDrawerSide"
                    />
                    <ArenaSection
                        v-model:teamArena="teamArena"
                        v-model:showArenaDrawer="showArenaDrawer"
                        :selectedDrawerSide="selectedDrawerSide"
                    />
                    <GMSection
                        v-model:teamGM="teamGM"
                        v-model:showGMDrawer="showGMDrawer"
                        :selectedDrawerSide="selectedDrawerSide"
                    />
                </div>
            </div>
        </div>

        <!-- Add Player Dialog -->
        <AddPlayerDialog
            v-model:open="showPlayerDialog"
            :position="selectedPlayerIndex !== null && selectedPlayerIndex <= 5 ? ['PG', 'SG', 'SF', 'PF', 'C'][selectedPlayerIndex - 1] : undefined"
            :slot-index="selectedPlayerIndex ?? undefined"
            :selectedDrawerSide="selectedDrawerSide"
            @select="addPlayerFromDialog"
        />

        <!-- Player Stats Dialog -->
        <PlayerStatsDialog
            v-model:visible="showPlayerStatsDialog"
            :data="playerStatsData"
            :rating-history="selectedPlayerRatingHistory"
            :player-name="selectedPlayerName"
        />

        <!-- Player Comparison -->
        <PlayerComparison
            v-model:visible="showPlayerComparison"
            :player1="comparisonPlayers[0]"
            :player2="comparisonPlayers[1]"
        />
    </main>
</template>

<style scoped>
.team-builder-page {
    min-height: 100vh;
    background-color: hsl(var(--background));
    padding: 2rem 0;
}

.page-container {
    max-width: 90rem;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.header-card {
    border-radius: 0.5rem;
    border: 0.125rem solid;
    border-color: hsla(var(--primary), 0.5);
    background-color: hsl(var(--card));
    transition: all 0.2s ease;
    overflow: hidden;
}

.header-card:hover {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0.5rem hsla(var(--primary), 0.3);
}

.staff-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: hsl(var(--foreground));
    letter-spacing: -0.025em;
    margin: 0;
}

.staff-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
}

@media (min-width: 768px) {
    .staff-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (min-width: 640px) {
    .page-container {
        padding: 0 1.5rem;
    }
}

@media (min-width: 1024px) {
    .page-container {
        padding: 0 2rem;
    }
}
</style>
