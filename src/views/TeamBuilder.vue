<script setup lang="ts">
import { ref, watch, computed, Transition, onMounted } from "vue";
import PageTitle from "@/components/PageTitle.vue";
import TeamBuilderHeader from "@/components/TeamBuilder/TeamBuilderHeader.vue";
import PlayerStatsDialog from "@/components/TeamBuilder/PlayerStatsDialog.vue";
import CoachSection from "@/components/TeamBuilder/CoachSection.vue";
import ArenaSection from "@/components/TeamBuilder/ArenaSection.vue";
import PlayerComparison from "@/components/TeamBuilder/PlayerComparison.vue";
import GMSection from "@/components/TeamBuilder/GMSection.vue";
import {
    BDL_API_PREFIX,
    VIEWS,
    DRAWER_SIDES,
    DEFAULT_NOTIFICATION_PROPS,
} from "@/constants/constants";
import type { DrawerSide } from "@/constants/constants";
import { range } from "@/constants/functions";
import { debounce, useQuasar, type QNotifyCreateOptions } from "quasar";
import type { Team } from "@/lib/types";
import { uid } from "quasar";
import draggable from "vuedraggable";
import axios from "axios";

const $q = useQuasar();

/* Team Metadata */
const teamName = ref<string>("");
const teamDescription = ref<string>("");
const teamCity = ref<string>("");
const teamCountry = ref<string>("");
const teamLogo = ref<string>("");

const teamCoach = ref<any>(null);
const teamArena = ref<any>(null);
const teamGM = ref<any>(null);

const showPlayerDrawer = ref<boolean>(false);
const showCoachDrawer = ref<boolean>(false);
const showArenaDrawer = ref<boolean>(false);
const showGMDrawer = ref<boolean>(false);

const search = ref<string>("");
const searchList = ref<any[]>([]);
const searchLoading = ref<boolean>(false);
/* Typing guide: https://vuejs.org/guide/typescript/composition-api.html */
const selectedPlayerIndex = ref<number | null>(null);
const selectedPlayersData = ref<Map<any, any>>(new Map());
const selectedPlayerStats = ref<any>([]);

const playerStatsData = computed(() => {
    return selectedPlayerStats.value.map((item: any, index: number) => {
        return {
            ...item,
            id: index,
        };
    });
});

const cardsFlipped = ref<Map<any, boolean>>(new Map());
const showTransition = ref(false);

const showPlayerStatsDialog = ref<boolean>(false);

const sortOptions = ["Alphabetic (A-Z)", "Reverse Alphabetic (Z-A)"];
const selectedView = ref<string>(VIEWS.DEFAULT);
const selectedDrawerSide = ref<any>("right");
const headerExpanded = ref<boolean>(false);

const selectedPlayersForComparison = ref<Set<any>>(new Set());
const selectedComparePlayers = computed(() => {
    const comparePlayers = [...selectedPlayersForComparison.value];
    console.log({ playerStatsData, comparePlayers });
    return comparePlayers.slice(0, 2);
});

/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);

const selectedFilters = ref<string[]>([]);
const PLAYER_FILTERS = ["Current Season Only", "PG", "SG", "SF", "PF", "C"];

/* TODO: Team Score */
const teamScore = ref<number>(0);

const activeDrawer = computed(() => {
    if (showCoachDrawer.value) {
        return "Coach";
    }
    if (showArenaDrawer.value) {
        return "Arena";
    }
    if (showGMDrawer.value) {
        return "GM";
    }
    return null;
});

const showRemovePlayerDialog = ref<boolean>(false);

/* Watchers */

watch(activeDrawer, (newDisplayedDrawer) => {
    switch (newDisplayedDrawer) {
        case "Coach":
            showPlayerDrawer.value = false;
            showArenaDrawer.value = false;
            showGMDrawer.value = false;
            break;
        case "Arena":
            showPlayerDrawer.value = false;
            showCoachDrawer.value = false;
            showGMDrawer.value = false;
            break;
        case "GM":
            showPlayerDrawer.value = false;
            showCoachDrawer.value = false;
            showArenaDrawer.value = false;
            break;
    }
});

/* Note to self: Use watchers to get reactive console logs */
watch(selectedFilters, (selectedFilters, prevFilters) => {
    console.log(selectedFilters, prevFilters);
});

const addPlayer = (index: number) => {
    selectedPlayerIndex.value = index;
    /* If already visible, don't do anything */
    if (showPlayerDrawer.value) {
        return;
    }
    showPlayerDrawer.value = !showPlayerDrawer.value;
};

const deletePlayer = (index: number) => {
    selectedPlayersData.value.delete(index);
    cardsFlipped.value.delete(index);
};

const searchListResults = computed(() =>
    searchList.value.map((player: any) => {
        const {
            first_name,
            last_name,
            height_feet,
            height_inches,
            weight_pounds,
        } = player;
        const fullName = `${first_name} ${last_name}`;
        const heightString =
            height_feet && height_inches
                ? `${height_feet}' ${height_inches}"`
                : "N/A Height";
        const weightString = weight_pounds
            ? `${weight_pounds}lbs`
            : "N/A Weight";
        const heightAndWeight = `${heightString}, ${weightString}`;
        return {
            ...player,
            fullName,
            heightAndWeight,
        };
    })
);

/* TODO: See if putting this into separate function still works */
watch(
    search,
    debounce(async () => {
        const searchedPlayer = search.value;

        /* If not an empty string, make API call */
        if (searchedPlayer) {
            /* TODO: Disable the search input while search is loading? */
            searchLoading.value = true;
            /* TODO: Review this, clearing the list before every API call*/
            searchList.value = [];

            try {
                let next_page = null;
                do {
                    const page: number | null = next_page ? next_page : "";
                    const response: any = await axios.get(
                        `${BDL_API_PREFIX}/players?per_page=50&search=${searchedPlayer}&page=${page}`
                    );
                    const { data, meta } = response.data;
                    next_page = meta.next_page;
                    searchList.value = [...searchList.value, ...data];
                } while (next_page != null);
            } catch (error) {
                console.error("Error! Failed to make search API call: ", error);
                /* */
            } finally {
                console.log({ searchList: searchList.value });
                searchLoading.value = false;
            }
        } else {
            /* Clear the search list if no longer any players being searched for */
            searchList.value = [];
        }
    }, 600)
);

const getPlayerStats = async (playerId: number) => {
    const MAX_SEASON = 1983;
    const MAX_SEASONS_MISSED = 5;

    let season = 2022;
    let seasonsWithNoData = 0;

    const playerStats: any[] = [];
    /* Keep retrieving season averages until the number of seasons with no data > 5 */
    while (season !== MAX_SEASON && seasonsWithNoData !== MAX_SEASONS_MISSED) {
        const url = `${BDL_API_PREFIX}/season_averages?season=${season}&player_ids[]=${playerId}`;
        try {
            /* Retrieve season averages of player */
            const response = await axios.get(url);
            console.log("Axios Response object = ", { response });
            const responseData = response.data;

            /* If there's no data, increment count of seasons w/ no data */
            if (responseData.data.length === 0) {
                console.log("No data for this player in this season", {
                    seasonsWithNoData,
                });
                /* Break out of while loop if the # of seasons w/ no data has reached 5 */
                seasonsWithNoData++;
                if (seasonsWithNoData === MAX_SEASONS_MISSED) {
                    break;
                }
            } else {
                console.log(
                    "Response for player in the season ",
                    responseData.data
                );
                const playerSeasonAvgs = responseData.data[0];
                playerStats.push(playerSeasonAvgs);
            }
        } catch (err) {
            console.error(err);
        }

        /* Decrement the season counter */
        season--;
    }

    return playerStats;
};

const addPlayerFromList = async (player: any) => {
    /* Index of the card for which they are adding/modifying */
    const playerIndex = selectedPlayerIndex.value;
    console.log({ playerIndex });
    // const currentPlayer = selectedPlayersData.value.get(playerIndex);
    // console.log({ currentPlayer });

    /* Retrieve player stats */
    const { id } = player;
    const playerStats = await getPlayerStats(id);
    console.log("Player's stats = ", { playerStats });

    /* Add player stats to the player object */
    const updatedPlayerData = { ...player, playerStats };

    /* Set the player data at that index in the map */
    selectedPlayersData.value.set(playerIndex, updatedPlayerData);
    console.log("Selected Players Data = ", selectedPlayersData.value);

    /* Add new entry to the cards flipped map */
    cardsFlipped.value.set(playerIndex, false);
};

// TODO
const resetTeam = async () => {
    /* Reset coach, arena, and GM selections */
    teamCoach.value = null;
    teamArena.value = null;
    teamGM.value = null;

    // axios.get("/login/").then((res) => console.log(res.data));
};

const saveTeam = () => {
    let message = "Successfully saved team!";
    const uuid = uid();

    const testPlayers = [
        "Damian Lillard",
        "LeBron James",
        "Giannis Antetokounmpo",
    ];

    const newTeam: Team = {
        uuid,
        description: "This is a test team",
        name: teamName.value,
        players: testPlayers,
    };

    axios.post(`/api/team/`, newTeam).then((res) => console.log(res.data));
    /* If there's an existing ID for this team */
    // if (item.id) {
    //   axios
    //     .put(`/api/team/`, item)
    //     .then((res) => {});
    //   message = "Successfully created team!";
    //   return;
    // }
    // axios
    //   .post("/api/todos/", item)
    //   .then((res) => this.refreshList());

    // TODO: determine if saving was successful or not
    $q.notify({
        message,
        type: "positive",
        ...(DEFAULT_NOTIFICATION_PROPS as Partial<QNotifyCreateOptions>),
    });
};

const flipCard = (n: number) => {
    // if (flipElement) {
    //   if (cardsFlipped.value.get(n)) {
    //     flipElement.classList.remove('flip-enter-active');
    //     flipElement.classList.add('flip-leave-active');
    //   } else {
    //     flipElement.classList.remove('flip-leave-active');
    //     flipElement.classList.add('flip-enter-active');
    //   }
    // }

    const isFlipped = cardsFlipped.value.get(n);
    console.log("Flipping card: ", !isFlipped);
    cardsFlipped.value.set(n, !isFlipped);

    if (!isFlipped) {
        showTransition.value = true;
        setTimeout(() => {
            showTransition.value = false;
        }, 400);
    }
};

const viewPlayerStats = () => {
    /* Retrieve player stats from data map */
    const { playerStats } = selectedPlayersData.value.get(
        selectedPlayerIndex.value
    );
    /* Add an id to each for use in the table */
    const modifiedPlayerStats = playerStats.map((item: any, index: number) => {
        return {
            ...item,
            id: index,
        };
    });

    console.log(
        "Selected Player Stats ref being set to: ",
        modifiedPlayerStats
    );

    /* Store it in the ref */
    selectedPlayerStats.value = modifiedPlayerStats;

    console.log(
        "Actual value of selectedPlayerStats = ",
        selectedPlayerStats.value
    );

    /* Show the player stats popup */
    showPlayerStatsDialog.value = true;
};

const togglePlayerInComparison = (n: number) => {
    const isSelected = selectedPlayersForComparison.value.has(n);

    /* Show toast notification if trying to add more than 2 players to comparison */
    if (selectedPlayersForComparison.value.size === 2 && !isSelected) {
        $q.notify({
            message: "You can only compare two players at a time",
            type: "warning",
            ...(DEFAULT_NOTIFICATION_PROPS as Partial<QNotifyCreateOptions>),
        });
        return;
    }

    const playerName = selectedPlayersData.value.get(n).fullName;
    let message;
    if (isSelected) {
        message = `Removed player ${playerName} from comparison`;
        selectedPlayersForComparison.value.delete(n);
    } else {
        message = `Added player ${playerName} to comparison`;
        selectedPlayersForComparison.value.add(n);
    }

    /* Show toast notification */
    $q.notify({
        message,
        type: "info",
        ...(DEFAULT_NOTIFICATION_PROPS as Partial<QNotifyCreateOptions>),
    });
};

// Example Reactive Console Log:
// watch(teamName, (newTeamName, previousTeamName) => {
//   console.log("test = ", {newTeamName, previousTeamName});
// });

/* TODO: Drag Player Cards Functionality */

/*  Note on draggable cards:
https://stackoverflow.com/questions/73325793/horizontally-draggable-quasar-q-cards-using-vue-draggable-next
*/
const drag = ref<boolean>(false);
const items = ref([
    { id: "1", name: "item1" },
    { id: "2", name: "item2" },
    { id: "3", name: "item3" },
    { id: "4", name: "item4" },
    { id: "5", name: "item5" },
]);
const testArray = ref([]);
</script>

<template>
    <main class="builder-page">
        <PageTitle />
        <div
            class="builder-container shadow-8"
            :class="{ expanded: headerExpanded }"
        >
            <TeamBuilderHeader
                v-model:headerExpanded="headerExpanded"
                v-model:teamName="teamName"
                v-model:teamDescription="teamDescription"
                v-model:teamCity="teamCity"
                v-model:drawerSide="selectedDrawerSide"
                v-model:selectedView="selectedView"
                v-model:teamCountry="teamCountry"
                v-model:teamLogo="teamLogo"
                @saveTeam="saveTeam"
                @reset="resetTeam"
            />
            <div class="builder-main">
                <div class="builder-header">
                    <h6 class="section-header">Starters</h6>
                    <h6 class="player-count">
                        Player Count: {{ selectedPlayersData.size }} / 15
                    </h6>
                </div>
                <div
                    class="main-lineup"
                    :class="{ list: selectedView === VIEWS.LIST }"
                >
                    <template :key="n" v-for="n in 5">
                        <Transition name="flip" mode="in-out">
                            <q-card
                                dark
                                class="player-card"
                                :key="n"
                                :class="{
                                    selected: selectedPlayersData.has(n),
                                }"
                                bordered
                                @click="() => flipCard(n)"
                            >
                                <q-card-section>
                                    <h6>Player {{ n }}</h6>
                                </q-card-section>
                                <q-separator dark />
                                <q-card-section class="main-card-section">
                                    <q-btn
                                        v-if="!selectedPlayersData.has(n)"
                                        @click="addPlayer(n)"
                                        flat
                                        round
                                        icon="add_circle"
                                        size="1.75rem"
                                        class="add-player-btn"
                                        title="Add Player"
                                    />
                                    <template v-else>
                                        <template v-if="cardsFlipped.get(n)">
                                            <q-btn
                                                outline
                                                color="primary"
                                                @click.stop="viewPlayerStats"
                                            >
                                                View Player Stats
                                            </q-btn>
                                        </template>
                                        <template v-else>
                                            <q-icon
                                                class="blank-avatar"
                                                name="account_circle"
                                                size="3.5rem"
                                            />
                                            <div>
                                                {{
                                                    selectedPlayersData.get(n)
                                                        .fullName
                                                }}
                                            </div>
                                        </template>
                                    </template>
                                </q-card-section>
                                <q-separator dark />
                                <q-card-actions>
                                    <q-btn
                                        @click="deletePlayer(n)"
                                        flat
                                        round
                                        icon="delete"
                                        color="negative"
                                        title="Delete player from team"
                                    />
                                    <q-btn
                                        v-if="selectedPlayersData.has(n)"
                                        flat
                                        round
                                        icon="compare_arrows"
                                        :title="
                                            selectedPlayersForComparison.has(n)
                                                ? 'Remove from comparison'
                                                : 'Select for comparison'
                                        "
                                        :color="
                                            selectedPlayersForComparison.has(n)
                                                ? 'primary'
                                                : 'white'
                                        "
                                        @click.stop="
                                            togglePlayerInComparison(n)
                                        "
                                    />
                                </q-card-actions>
                            </q-card>
                        </Transition>
                    </template>
                </div>
                <h6 class="section-header">Bench</h6>
                <div
                    class="bench-lineup"
                    :class="{ list: selectedView === VIEWS.LIST }"
                >
                    <q-card
                        dark
                        class="player-card"
                        bordered
                        :key="n"
                        v-for="n in range(6, 15)"
                    >
                        <q-card-section>
                            <h6>Player {{ n }}</h6>
                        </q-card-section>
                        <q-separator />
                        <q-card-section class="main-card-section">
                            <q-btn
                                v-if="!selectedPlayersData.has(n)"
                                @click="addPlayer(n)"
                                flat
                                round
                                icon="add_circle"
                                size="1.75rem"
                                class="add-player-btn"
                                title="Add Player"
                            />
                            <template v-else>
                                <template v-if="cardsFlipped.get(n)">
                                    <q-btn
                                        outline
                                        color="primary"
                                        @click.stop="viewPlayerStats"
                                    >
                                        View Player Stats
                                    </q-btn>
                                </template>
                                <template v-else>
                                    <q-icon
                                        class="blank-avatar"
                                        name="account_circle"
                                        size="3.5rem"
                                    />
                                    <div>
                                        {{
                                            selectedPlayersData.get(n).fullName
                                        }}
                                    </div>
                                </template>
                            </template>
                        </q-card-section>
                        <q-separator dark />
                        <q-card-actions>
                            <q-btn
                                @click="deletePlayer(n)"
                                flat
                                round
                                icon="delete"
                                color="negative"
                            />
                        </q-card-actions>
                    </q-card>
                </div>
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
        <q-drawer
            class="drawer"
            v-model="showPlayerDrawer"
            :width="300"
            bordered
            elevated
            overlay
            dark
            :side="selectedDrawerSide"
        >
            <div class="drawer-header">
                <div class="drawer-title-container">
                    <h6 class="drawer-title">Add Player</h6>
                    <q-btn
                        @click="showPlayerDrawer = false"
                        round
                        icon="close"
                        class="drawer-close"
                    />
                </div>
                <q-input
                    outlined
                    v-model="search"
                    placeholder="Search for a player"
                    type="search"
                    dark
                >
                    <template v-slot:append>
                        <q-icon name="search" />
                    </template>
                </q-input>
                <q-linear-progress
                    v-if="searchLoading"
                    indeterminate
                    color="primary"
                />
                <div>
                    <q-select
                        outlined
                        v-model="selectedSort"
                        :options="sortOptions"
                        label="Sort"
                        clearable
                        dark
                    />
                    <q-btn color="primary" label="Filters Menu">
                        <q-menu dark>
                            <q-list style="min-width: 100px">
                                <template
                                    v-for="(filter, index) in PLAYER_FILTERS"
                                    :key="index"
                                >
                                    <q-item tag="label" avatar>
                                        <q-item-section>
                                            <q-checkbox
                                                v-model="selectedFilters"
                                                :val="filter"
                                                dark
                                            />
                                        </q-item-section>
                                        <q-item-section>
                                            <q-item-label>{{
                                                filter
                                            }}</q-item-label>
                                        </q-item-section>
                                    </q-item>
                                </template>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </div>
            </div>
            <q-separator dark />
            <q-scroll-area class="fit">
                <q-list>
                    <template
                        v-for="player in searchListResults"
                        :key="player.id"
                    >
                        <q-item
                            @click="addPlayerFromList(player)"
                            clickable
                            v-ripple
                        >
                            <q-item-section class="player-item">
                                <div>
                                    <div>{{ player.fullName }}</div>
                                    <div>{{ player.heightAndWeight }}</div>
                                    <div>{{ player.team.full_name }}</div>
                                </div>
                                <div class="player-position">
                                    {{ player.position }}
                                </div>
                            </q-item-section>
                        </q-item>
                        <q-separator />
                    </template>
                </q-list>
            </q-scroll-area>
        </q-drawer>
        <PlayerStatsDialog
            v-model:visible="showPlayerStatsDialog"
            :data="playerStatsData"
        />
        <PlayerComparison
            v-if="selectedPlayersForComparison.size === 2"
            :player1Data="playerStatsData[selectedComparePlayers[0]]"
            :player2Data="playerStatsData[selectedComparePlayers[1]]"
        />
        <q-dialog v-model="showRemovePlayerDialog">
            <q-card dark>
                <q-card-section class="row items-center">
                    <div>Are you sure you want to reset your whole team?</div>
                </q-card-section>
                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="primary" v-close-popup />
                    <!-- TODO: @click for q-btn  -->
                    <q-btn label="Confirm" color="primary" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </main>
</template>

<style scoped>
.builder-page {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 0 4rem;
}

.builder-container {
    background: var(--vt-c-black-soft);
    width: calc(100% - 10rem);
    height: 37rem;
    border-radius: 0.25rem;
    /* display: grid;
  grid-template-rows: 6rem auto; */
}

.builder-container.expanded {
    height: 40rem;
}

.header {
    display: flex;
    flex-direction: column;
    border-bottom: 0.125rem solid var(--vt-c-divider-dark-1);
}

.header-top {
    display: flex;
    flex-direction: row;
    align-items: center;
}

.header.expanded {
    height: 10rem;
}

.title-input {
    width: 15%;
    margin-left: 2rem;
}

.hidden {
    visibility: hidden;
}

.score {
    display: flex;
    font-size: 2rem;
    font-weight: 600;
    margin-left: auto;
    /* justify-self: center; */
}

.builder-main {
    margin: 1rem 2rem 0 2rem;
    height: 28rem;
    overflow-y: auto;
}

.main-lineup,
.bench-lineup {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 2rem;
    grid-auto-flow: row;
}

.main-lineup.list,
.bench-lineup.list {
    grid-template-columns: unset;
}

.player-card {
    display: grid;
    grid-template-rows: 4rem auto 8rem auto 3rem;
}

.player-card.selected {
    cursor: pointer;
}

.flip-enter-active,
.flip-leave-active {
    transition: all 0.4s ease;
}

.flip-enter,
.flip-leave-to {
    transform: rotateY(180deg);
    opacity: 0;
}

.flip-leave,
.flip-enter-to {
    transform: rotateY(0);
    opacity: 1;
}

.section-header {
    margin: 1rem 0;
}

.builder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

::-webkit-scrollbar {
    display: none;
}

.main-card-section {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

/* Drawer Styles */

/* Hide scrollbar in header section of drawer */
::v-deep .q-drawer__content.scroll {
    overflow: hidden;
}

.drawer-header {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.drawer-title-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding-left: 1rem;
    margin-bottom: 0.5rem;
}

.q-drawer > .q-drawer__content {
    overflow: hidden;
}

.drawer-close {
    margin-left: auto;
}

.player-item {
    display: flex;
    flex-direction: row;
    align-items: center;
}

.player-position {
    margin-left: auto;
}
</style>
