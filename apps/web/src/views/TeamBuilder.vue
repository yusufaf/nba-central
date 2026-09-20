<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from 'vue-sonner';
import axios from 'axios';
import PageTitle from "@/components/PageTitle.vue";
import PageShell from "@/layouts/PageShell.vue";
import TeamBuilderHeader from "@/components/TeamBuilder/TeamBuilderHeader.vue";
import RosterSection from "@/components/TeamBuilder/RosterSection.vue";
import AddPlayerDialog from "@/components/TeamBuilder/AddPlayerDialog.vue";
import PlayerStatsDialog from "@/components/TeamBuilder/PlayerStatsDialog.vue";
import CoachSection from "@/components/TeamBuilder/CoachSection.vue";
import ArenaSection from "@/components/TeamBuilder/ArenaSection.vue";
import GMSection from "@/components/TeamBuilder/GMSection.vue";
import PlayerComparison from "@/components/TeamBuilder/PlayerComparison.vue";
import {
    useRosterDragDrop,
    swapMapEntries,
    swapSetMembers,
} from "@/composables/useRosterDragDrop";
import { serializeTeam, hydrateTeam, remixTitle } from "@/composables/useTeamPersistence";
import { dataApi, teamApi } from "@/network/api";
import { useUserTeamsStore } from "@/stores/userTeams";
import { renderShareCard, toShareCardProps } from "@/composables/useShareCard";
import { shareUrlFor } from "@/utils/shareUrl";
import { downloadUrlAsFile, slugFilename } from "@/utils/downloadFile";
import { track } from "@/lib/analytics";
import type { DrawerSide, NBA2KRating } from "@/models/types";
import type { GetPlayerStatsResponse } from "@/models/api";

const route = useRoute();
const router = useRouter();
const userTeamsStore = useUserTeamsStore();

// Set once a team is loaded from /teams (route query `team`) or freshly
// saved. Present means saveTeam() updates that team in place; absent means
// it creates a new one.
const loadedTeamUUID = ref<string | null>(null);

// Share state for the loaded team. `teamOwner` is the Logto username the
// API stamps on a saved team; the card and the public page attribute to it.
const isPublic = ref(false);
const cardUrl = ref<string | null>(null);
const publishing = ref(false);
const teamOwner = ref("");

/* Team Metadata */
const teamName = ref<string>("");
const teamDescription = ref<string>("");
const teamCity = ref<string>("");
const teamCountry = ref<string>("");
const teamLogo = ref<string>("");
const teamJersey = ref<string>("");

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

// Slot index -> name of the player being fetched into it. Keyed by slot rather
// than a single flag so two slots can be filling at once.
const pendingPlayers = ref<Map<number, string>>(new Map());
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

// Fetches a player's career stats/rating history and lands the full record
// in the slot. Shared by adding a new player from the dialog and hydrating a
// loaded team - both start from a full player object and only need the
// stats round trip. Marking the slot pending first lets the card show an
// in-place wait rather than nothing while that request is out.
const loadPlayerIntoSlot = async (slot: number, player: any) => {
    pendingPlayers.value.set(slot, player.fullName ?? "");
    try {
        const { id } = player;
        const { data: playerStats, ratingHistory } = await getPlayerStats(id);
        const updatedPlayerData = { ...player, playerStats, ratingHistory };
        selectedPlayersData.value.set(slot, updatedPlayerData);
        cardsFlipped.value.set(slot, false);
    } finally {
        pendingPlayers.value.delete(slot);
    }
};

const addPlayerFromDialog = async (player: any) => {
    const playerIndex = selectedPlayerIndex.value;
    // The dialog is only opened from a slot, so this is set - but the ref is
    // nullable and there is no slot to report progress against without it.
    if (playerIndex === null) return;

    const playerName = `${player.first_name} ${player.last_name}`;

    // The toast lives in the corner, far from the slot the player is landing
    // in - loadPlayerIntoSlot marks the slot pending so the card shows the
    // same wait in place.
    toast.promise(loadPlayerIntoSlot(playerIndex, player), {
        loading: `Adding ${playerName} to ${slotLabel(playerIndex)}...`,
        success: `Added ${playerName} to ${slotLabel(playerIndex)}`,
        error: `Failed to add ${playerName} to ${slotLabel(playerIndex)}`,
    });
};

const deletePlayer = (index: number) => {
    const player = selectedPlayersData.value.get(index);
    // A held card that's just been removed has nothing left to drop.
    if (pickedUpSlot.value === index) cancelPickup();
    selectedPlayersData.value.delete(index);
    cardsFlipped.value.delete(index);
    selectedPlayersForComparison.value.delete(index);

    if (player) {
        toast.success(`Removed ${player.fullName} from team`);
    }
};

// Slots are fixed positions, not a list, so a drag is a swap: the two cards
// trade places and nothing else in the roster shifts. Flip state and comparison
// picks are keyed by slot as well, so they have to travel with the card or
// they'd end up attached to whoever landed in that slot.
const swapSlots = (from: number, to: number) => {
    if (from === to) return;

    const players = selectedPlayersData.value;
    if (!players.has(from) && !players.has(to)) return;

    swapMapEntries(players, from, to);
    swapMapEntries(cardsFlipped.value, from, to);
    swapSetMembers(selectedPlayersForComparison.value, from, to);
};

const slotLabel = (slot: number) =>
    slot <= 5 ? ["PG", "SG", "SF", "PF", "C"][slot - 1] : `slot ${slot}`;

const describeSlot = (slot: number) => {
    const player = selectedPlayersData.value.get(slot);
    return player
        ? `${player.fullName} in ${slotLabel(slot)}`
        : `empty ${slotLabel(slot)}`;
};

const {
    draggingSlot,
    dropTargetSlot,
    pickedUpSlot,
    liveMessage,
    startDrag,
    endDrag,
    dragOverSlot,
    leaveSlot,
    dropOnSlot,
    togglePickup,
    cancelPickup,
} = useRosterDragDrop({
    onSwap: swapSlots,
    isOccupied: (slot) => selectedPlayersData.value.has(slot),
    isPending: (slot) => pendingPlayers.value.has(slot),
    describeSlot,
});

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

// Shared by the user-facing "Clear Team" button and route-driven resets
// (navigating from a loaded team to a bare /teambuilder). Resetting
// loadedTeamUUID here matters: without it, Save after a clear would still
// update the previously loaded team instead of creating a new one.
const clearBuilderState = () => {
    cancelPickup();
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
    teamJersey.value = "";
    loadedTeamUUID.value = null;
    isPublic.value = false;
    cardUrl.value = null;
    teamOwner.value = "";
};

const resetTeam = () => {
    clearBuilderState();
    toast.success('Team cleared successfully');
};

const saveTeam = () => {
    const payload = serializeTeam({
        teamName: teamName.value,
        teamDescription: teamDescription.value || "Custom NBA Team",
        teamCity: teamCity.value,
        teamCountry: teamCountry.value,
        teamLogo: teamLogo.value,
        teamJersey: teamJersey.value,
        selectedPlayersData: selectedPlayersData.value,
        teamCoach: teamCoach.value,
        teamArena: teamArena.value,
        teamGM: teamGM.value,
    });

    const existingUUID = loadedTeamUUID.value;

    toast.promise(
        async () => {
            const saved = existingUUID
                ? await userTeamsStore.update({ ...payload, teamUUID: existingUUID })
                : await userTeamsStore.save(payload);
            loadedTeamUUID.value = saved.teamUUID;
            teamOwner.value = saved.username ?? teamOwner.value;
            track("team_saved", { isNew: !existingUUID, playerCount: payload.roster.length });
            // Puts the team's uuid in the URL after the first save so a
            // refresh still knows to update this team rather than create
            // a duplicate on the next save.
            if (!existingUUID) {
                router.replace({ query: { ...route.query, remix: undefined, team: saved.teamUUID } });
            }
            if (isPublic.value) {
                await setPublished(true, { silent: true });
            }
        },
        {
            loading: existingUUID ? 'Saving team...' : 'Creating team...',
            success: existingUUID ? 'Team saved!' : 'Team created!',
            error: existingUUID ? 'Failed to save team' : 'Failed to create team',
        }
    );
};

const currentCardProps = () =>
    toShareCardProps({
        title: teamName.value,
        city: teamCity.value,
        country: teamCountry.value,
        logoUrl: teamLogo.value,
        jerseyUrl: teamJersey.value,
        username: teamOwner.value,
        roster: Array.from(selectedPlayersData.value.entries()).map(([slot, player]) => ({
            slot,
            player: { ...player, fullName: player.fullName },
        })),
    });

// A failed render must not block publishing: the page falls back to the
// site poster for og:image and the owner gets told.
const tryRenderCard = async (): Promise<string | null> => {
    try {
        return await renderShareCard(currentCardProps());
    } catch (err) {
        console.error("Share card render failed:", err);
        return null;
    }
};

const copyShareLink = async (): Promise<boolean> => {
    if (!loadedTeamUUID.value) return false;
    try {
        await navigator.clipboard.writeText(shareUrlFor(loadedTeamUUID.value));
        return true;
    } catch (err) {
        console.error("Clipboard write failed:", err);
        return false;
    }
};

// `silent` is the re-publish after a save of an already-public team: the
// card is refreshed so unfurls never show a stale roster, without toasting
// twice.
const setPublished = async (nextPublic: boolean, { silent = false } = {}) => {
    const teamUUID = loadedTeamUUID.value;
    if (!teamUUID) throw new Error("Cannot publish an unsaved team");
    publishing.value = true;
    try {
        const cardPng = nextPublic ? await tryRenderCard() : null;
        const saved = await userTeamsStore.publish({ teamUUID, public: nextPublic, cardPng });
        isPublic.value = saved.public;
        cardUrl.value = saved.cardUrl ?? null;
        track("team_published", { public: nextPublic, hasCard: cardPng !== null, silent });
        if (silent) return;
        if (nextPublic) {
            const copied = await copyShareLink();
            toast.success(
                copied
                    ? (cardPng ? "Published — link copied" : "Published without a preview image — link copied")
                    : "Published — copy the link from Share",
            );
        } else {
            toast.success("Team is private again");
        }
    } catch (err) {
        console.error("Publish failed:", err);
        if (silent) {
            toast.warning("Saved, but the share preview could not be refreshed");
        } else {
            toast.error(nextPublic ? "Failed to publish team" : "Failed to unpublish team");
        }
    } finally {
        publishing.value = false;
    }
};

const togglePublish = () => setPublished(!isPublic.value);

const shareTeam = async (method: "copy" | "native") => {
    if (!loadedTeamUUID.value) return;
    const url = shareUrlFor(loadedTeamUUID.value);
    track("share_clicked", { method, page: "builder" });
    if (method === "native" && typeof navigator.share === "function") {
        try {
            await navigator.share({ title: teamName.value, url });
        } catch {
            // User dismissed the sheet - not an error.
        }
        return;
    }
    const copied = await copyShareLink();
    toast[copied ? "success" : "error"](
        copied ? "Link copied" : "Couldn't copy — copy it from your browser's address bar",
    );
};

const downloadCard = async () => {
    if (!cardUrl.value) return;
    track("card_downloaded", { page: "builder" });
    try {
        await downloadUrlAsFile(cardUrl.value, slugFilename(teamName.value, "png"));
    } catch (err) {
        console.error("Card download failed:", err);
        toast.error("Failed to download card");
    }
};

// Loading an existing team via ?team=<uuid> (e.g. from /teams). Metadata
// restores synchronously; each roster slot then streams its career stats in
// through loadPlayerIntoSlot, same as adding a player fresh.
const loadTeamFromRoute = async (teamUUID: string) => {
    try {
        const response = await teamApi.getTeam(teamUUID);
        if (!response.success) {
            toast.error(response.error || "Failed to load team");
            return;
        }

        const hydrated = hydrateTeam(response.data);
        loadedTeamUUID.value = response.data.teamUUID;
        isPublic.value = response.data.public ?? false;
        cardUrl.value = response.data.cardUrl ?? null;
        teamOwner.value = response.data.username ?? "";
        teamName.value = hydrated.teamName;
        teamDescription.value = hydrated.teamDescription;
        teamCity.value = hydrated.teamCity;
        teamCountry.value = hydrated.teamCountry;
        teamLogo.value = hydrated.teamLogo;
        teamJersey.value = hydrated.teamJersey;
        teamCoach.value = hydrated.teamCoach;
        teamArena.value = hydrated.teamArena;
        teamGM.value = hydrated.teamGM;

        await Promise.all(
            Array.from(hydrated.players.entries()).map(([slot, player]) =>
                loadPlayerIntoSlot(slot, player),
            ),
        );
    } catch (err) {
        console.error("Error loading team:", err);
        toast.error("Failed to load team");
    }
};

// Remixing a public team (/teambuilder?remix=<uuid>): same hydration as
// loading your own, but loadedTeamUUID stays null so the first Save
// creates a new team under the remixer. Works signed out; Save prompts
// login as it always has.
const loadRemixFromRoute = async (teamUUID: string) => {
    // Cleared before the fetch, not just on failure: the axios instance's
    // default validateStatus makes a 404 reject rather than resolve with
    // success: false, so it lands in the catch below - if the builder still
    // held a previously loaded team at that point, Save would overwrite it.
    clearBuilderState();
    try {
        const response = await teamApi.getPublicTeam(teamUUID);
        if (!response.success) {
            toast.error("That team isn't public");
            return;
        }
        const hydrated = hydrateTeam(response.data);
        teamName.value = remixTitle(hydrated.teamName);
        teamDescription.value = hydrated.teamDescription;
        teamCity.value = hydrated.teamCity;
        teamCountry.value = hydrated.teamCountry;
        teamLogo.value = hydrated.teamLogo;
        teamJersey.value = hydrated.teamJersey;
        teamCoach.value = hydrated.teamCoach;
        teamArena.value = hydrated.teamArena;
        teamGM.value = hydrated.teamGM;
        await Promise.all(
            Array.from(hydrated.players.entries()).map(([slot, player]) =>
                loadPlayerIntoSlot(slot, player),
            ),
        );
        track("remix_loaded", { sourceTeamUUID: teamUUID });
    } catch (err) {
        console.error("Error remixing team:", err);
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            toast.error("That team isn't public");
        } else {
            toast.error("Failed to load that team");
        }
    }
};

// Watches route.query.team/remix rather than onMounted alone: navigating
// between /teambuilder?team=A and a bare /teambuilder (e.g. the nav bar's
// "Team Builder" link) matches the same route record, so Vue Router reuses
// this component instance and onMounted never fires again. Without this
// watcher the builder kept showing team A - and Save would silently
// overwrite it. `team` wins if both are present. Passed as an array of
// getters (not a single getter returning a tuple) so Vue diffs each source
// independently - a single getter would return a new array identity on
// every navigation and fire the callback even when neither param changed.
watch(
    [() => route.query.team, () => route.query.remix],
    ([teamUUID, remixUUID]) => {
        if (typeof teamUUID === "string" && teamUUID) {
            loadTeamFromRoute(teamUUID);
        } else if (typeof remixUUID === "string" && remixUUID) {
            loadRemixFromRoute(remixUUID);
        } else {
            clearBuilderState();
        }
    },
    { immediate: true },
);
</script>

<template>
    <main class="team-builder-page">
        <PageTitle />

        <PageShell class="page-container">
            <!-- Team Builder Header -->
            <div class="header-card">
                <TeamBuilderHeader
                    v-model:headerExpanded="headerExpanded"
                    v-model:teamName="teamName"
                    v-model:teamDescription="teamDescription"
                    v-model:teamCity="teamCity"
                    v-model:teamCountry="teamCountry"
                    v-model:teamLogo="teamLogo"
                    v-model:teamJersey="teamJersey"
                    v-model:drawerSide="selectedDrawerSide"
                    v-model:selectedView="selectedView"
                    :team-uuid="loadedTeamUUID"
                    :is-public="isPublic"
                    :publishing="publishing"
                    :card-url="cardUrl"
                    @saveTeam="saveTeam"
                    @reset="resetTeam"
                    @togglePublish="togglePublish"
                    @share="shareTeam"
                    @downloadCard="downloadCard"
                />
            </div>

            <!-- Roster Section -->
            <RosterSection
                :selected-players="selectedPlayersData"
                :cards-flipped="cardsFlipped"
                :pending-players="pendingPlayers"
                :dragging-slot="draggingSlot"
                :drop-target-slot="dropTargetSlot"
                :picked-up-slot="pickedUpSlot"
                :live-message="liveMessage"
                @add-player="addPlayer"
                @remove-player="deletePlayer"
                @flip-card="flipCard"
                @view-stats="viewPlayerStats"
                @compare="togglePlayerInComparison"
                @drag-start="startDrag"
                @drag-end="endDrag"
                @drag-over="dragOverSlot"
                @drag-leave="leaveSlot"
                @drop-slot="dropOnSlot"
                @pickup="togglePickup"
                @cancel-pickup="cancelPickup"
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
        </PageShell>

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
}

/* Width, gutters and vertical padding come from PageShell; this only adds the
   stacking rhythm between the header, roster and staff sections. */
.page-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.header-card {
    border-radius: 0.5rem;
    border: 0.125rem solid;
    border-color: hsl(var(--primary) / 0.5);
    background-color: hsl(var(--card));
    transition: all 0.2s ease;
    overflow: hidden;
}

.header-card:hover {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0.5rem hsl(var(--primary) / 0.3);
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

</style>
