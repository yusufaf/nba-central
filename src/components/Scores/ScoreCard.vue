<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useQuasar } from "quasar";
import {
    HOME,
    AWAY,
    GAME_STATUS,
    ZERO_CLOCK,
    NOTIFICATION_GRANTED,
    NOTIFICATION_DENIED,
} from "@/constants/constants";
import LineScore from "./LineScore.vue";
import TeamDetailsTooltip from "./TeamDetailsTooltip.vue";
import type { CustomizationState } from "@/models/types";

/* Resource: https://dmitripavlutin.com/props-destructure-vue-composition/ */
const props = defineProps<{
    game: any;
    index: number;
    gameTeams: any;
    customizationState: CustomizationState;
}>();

const $q = useQuasar();

/* Refs */
const tooltipData = ref<any>(null);
const notificationPermission = ref<string>("");
const gameNotificationsMap = ref<any>(new Map());

/* Watchers */
watch(notificationPermission, (newPermission) => {
    if (newPermission === NOTIFICATION_GRANTED) {
        return;
    } else if (newPermission === NOTIFICATION_DENIED) {
        return;
    }
});

/* Computed Refs */
const fullGameName = computed(() => props.game.name);
const shortGameName = computed(() => props.game.shortName);
const gameNameToDisplay = computed(() => {
    const useShortNames: boolean = props.customizationState.get("shortNames");
    const nameToUse = useShortNames ? shortGameName : fullGameName;
    return nameToUse.value.replace('"', "");
});

/*TODO:
- Operating on the current date only until can figure out how to work with bkref to get previous games
- Bkref doesn't do current scores, so might have to actually differentiate data betwene previous days and current day
    - ESPN/NBA.com - current day | bkref - previous days
*/
const gameDate = computed(() => props.game.date);
const gameTimeStart = computed(() => {
    const timeString = new Date(props.game.date).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
    return timeString;
});

const gameTeamsSorted = computed(() => {
    /* Ensure away team shows up on top */
    const currentTeams = [...props.gameTeams[props.index]];

    // Find the object with the largest value for the specified property
    const maxObject = currentTeams.reduce((max, currentObj) => {
        // Convert the property value to a number before comparing
        const currentValue = parseFloat(currentObj.score);
        const maxValue = parseFloat(max.score);

        return currentValue > maxValue ? currentObj : max;
    }, currentTeams[0]);

    // Add a new property to the object with the largest value
    if (maxObject) {
        maxObject.winning = true;
    }

    return currentTeams.sort((a: any, b: any) => {
        return a.homeAway > b.homeAway ? 1 : b.homeAway > a.homeAway ? -1 : 0;
    });
});

const getRecordString = (teamRecords: any[], homeAway: string): string => {
    if (!teamRecords) {
        return "";
    }
    const [overallRecord, homeRecord, awayRecord] = teamRecords;
    let recordString = `(${overallRecord.summary}`;
    switch (homeAway) {
        case HOME: {
            recordString += `, ${homeRecord.summary} Home)`;
            break;
        }
        case AWAY: {
            recordString += `, ${awayRecord.summary} Away)`;
            break;
        }
    }
    return recordString;
};

const timePeriodLabels = computed(() => {
    const headerVals: string[] = [...Array(4).keys()].map((i) => `${i + 1}`);
    headerVals.push("T");
    const currentTeams = props.gameTeams[props.index];
    const lineScores = currentTeams[0].linescores ?? [];
    if (lineScores.length > 4) {
        headerVals.splice(4, 0, "OT");
    }
    return headerVals;
});

const gameStatusName = computed(() => props.game.status.type.name);
const gameScheduled = computed(
    () => gameStatusName.value === GAME_STATUS.SCHEDULED,
);
const gameInProgress = computed(
    () => gameStatusName.value === GAME_STATUS.IN_PROGRESS,
);

const isGameDone = computed(() => {
    const statusInfo = props.game.status.type;
    return statusInfo.completed;
});

const showScoresSection = computed(() => {
    const customizationState = props.customizationState;
    const hideFinishedGames = customizationState.get("hideFinishedGames");
    const hideScores = customizationState.get("hideScores");

    /*
        When to show the scores section:
        1. If the game is in progress or it finished
        2. User hasn't toggled "Hide Scores"
        3. Game isn't finished and user hasn't toggled "Hide Finished Games"
    */

    return Boolean(
        (gameInProgress.value || isGameDone.value) && // Condition 1
            !hideScores && // Condition 2
            (!isGameDone.value || !hideFinishedGames), // Condition 3
    );
});

const gameStatusDetail = computed(() => props.game.status.type.detail);

const gameClock = computed(() => {
    const { displayClock, period } = props.game.status;

    let currentPeriodString = `${period}Q`;
    if (period > 4) {
        const otNumber = period - 4;
        currentPeriodString = `${otNumber ? otNumber : ""}OT`;
    }

    const clockString = `${displayClock} - ${currentPeriodString}`;

    if (period === 2 && displayClock === ZERO_CLOCK) {
        return "Halftime";
    }
    return clockString;
});

const getRecordDetailsTooltip = (competitor: any): void => {
    const { id } = competitor;
    const teamURL = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}`;

    fetch(teamURL, {
        method: "GET",
    })
        .then((response) => {
            response.json().then((res) => {
                tooltipData.value = res.team;
            });
        })
        .catch((err) => {
            console.error(err);
        });
};

const leaderData = computed(() => {
    const currentTeams = props.gameTeams[props.index];

    const teamLeadersData: any[] = currentTeams.map((value) => {
        const { leaders } = value;
        const ratingLeaderData = leaders[leaders.length - 1];

        const [ratingLeader] = ratingLeaderData.leaders;
        const { athlete, displayValue } = ratingLeader;

        return {
            name: athlete.shortName, // Other props: displayName, fullName
            statline: displayValue,
            position: athlete.position.abbreviation,
            headshot: athlete.headshot,
            data: ratingLeader,
            id: athlete.id,
        };
    });

    // Reverse to go away -> home
    return teamLeadersData.reverse();
});

const toggleGameNotification = (id: string): void => {
    askNotificationPermission(id);
};

const checkNotificationPromise = (): boolean => {
    try {
        Notification.requestPermission().then();
    } catch (e) {
        return false;
    }
    return true;
};

const askNotificationPermission = (id: string): void => {
    /* Early return if browser permission has already been granted */
    if (notificationPermission.value === NOTIFICATION_GRANTED) {
        // const notification = new Notification("Hi there!");
        return;
    } else if (notificationPermission.value === NOTIFICATION_DENIED) {
        /* Send toast instructing what user needs to change, return early because browser won't ask again */
        $q.notify({
            message:
                "Please update your browser permissions to allow us to send you notifications",
            type: "negative",
            position: "bottom-left",
        });
        return;
    }

    const handlePermission = (permission: string) => {
        notificationPermission.value = permission;
    };

    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
        console.error("This browser does not support notifications.");
    } else if (checkNotificationPromise()) {
        Notification.requestPermission().then((permission) => {
            handlePermission(permission);
        });
    } else {
        Notification.requestPermission((permission) => {
            handlePermission(permission);
        });
    }
};

/* TODO: Browser notifications link: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API */
</script>

<template>
    <q-card dark class="score-card" bordered :key="game.uid">
        <q-card-section class="card-header">
            <h6>{{ gameNameToDisplay }}</h6>
            <!-- Toggled styling here ==> notifications vs notifications active -->
            <!-- v-if="!isGameDone" -->
            <div>
                <q-btn
                    @click="toggleGameNotification(game.uid)"
                    class="notification-bell"
                    flat
                    round
                    icon="notifications"
                    title="Notify me about the game"
                />
            </div>
        </q-card-section>
        <q-separator dark />
        <q-card-section class="main-section">
            <div class="teams-section">
                <div class="game-status">
                    <div class="clock active" v-if="gameInProgress">
                        {{ gameClock }}
                    </div>
                    <div class="clock" v-else-if="gameScheduled">
                        {{ gameTimeStart }}
                    </div>
                    <div class="clock" v-else>{{ gameStatusDetail }}</div>
                </div>
                <div
                    class="team-row"
                    :class="{ first: index === 0 }"
                    :key="competitor.id"
                    v-for="(competitor, index) in gameTeamsSorted"
                >
                    <img class="team-logo" :src="competitor.team.logo" />
                    <div class="team-info">
                        <div>{{ competitor.team.shortDisplayName }}</div>
                        <div
                            v-on:mouseenter="
                                getRecordDetailsTooltip(competitor)
                            "
                        >
                            <span>{{
                                getRecordString(
                                    competitor.records,
                                    competitor.homeAway,
                                )
                            }}</span>
                            <TeamDetailsTooltip
                                v-if="tooltipData"
                                :data="tooltipData"
                                :homeAway="competitor.homeAway"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div class="scores-section" v-if="showScoresSection">
                <div class="time-periods">
                    <template
                        v-for="(
                            timePeriod, timePeriodIndex
                        ) in timePeriodLabels"
                        :key="timePeriodIndex"
                    >
                        <div
                            class="time-period"
                            :class="{
                                total:
                                    timePeriodIndex ===
                                    timePeriodLabels.length - 1,
                            }"
                        >
                            {{ timePeriod }}
                        </div>
                    </template>
                </div>
                <template
                    v-for="competitor in gameTeamsSorted"
                    :key="competitor.id"
                >
                    <div class="scores-container">
                        <LineScore
                            :team="competitor"
                            :numberOfTimePeriods="
                                timePeriodLabels.slice(0, -1).length
                            "
                        />
                        <div
                            class="score"
                            :class="{ winning: competitor.winning }"
                        >
                            {{ competitor.score }}
                        </div>
                    </div>
                </template>
            </div>
        </q-card-section>
        <q-separator dark />
        <q-card-section class="leaders-section">
            <div class="leaders-header">
                {{ gameScheduled ? "Players to Watch" : "Top Performers" }}
            </div>
            <div class="leaders">
                <div
                    class="leader"
                    :key="id"
                    v-for="{
                        id,
                        headshot,
                        name,
                        position,
                        statline,
                    } in leaderData"
                >
                    <q-avatar class="headshot">
                        <q-img :src="headshot" height="50px" width="50px" />
                    </q-avatar>
                    <div class="leader-info">
                        <span>{{ `${name} - ${position}` }} </span>
                        <span>{{ statline }}</span>
                    </div>
                </div>
            </div>
        </q-card-section>
        <q-card-actions> </q-card-actions>
    </q-card>
</template>

<style scoped>
.score-card {
    height: 21.5rem;
    font-size: 1rem;
    overflow: hidden;
}

/* Header Styling */
.notification-bell {
    margin-left: auto;
    animation: ring 4s 0.7s ease-in-out;
    transform-origin: 50% 1px;
}

@keyframes ring {
    0% {
        transform: rotate(0);
    }

    1% {
        transform: rotate(30deg);
    }

    3% {
        transform: rotate(-28deg);
    }

    5% {
        transform: rotate(34deg);
    }

    7% {
        transform: rotate(-32deg);
    }

    9% {
        transform: rotate(30deg);
    }

    11% {
        transform: rotate(-28deg);
    }

    13% {
        transform: rotate(26deg);
    }

    15% {
        transform: rotate(-24deg);
    }

    17% {
        transform: rotate(22deg);
    }

    19% {
        transform: rotate(-20deg);
    }

    21% {
        transform: rotate(18deg);
    }

    23% {
        transform: rotate(-16deg);
    }

    25% {
        transform: rotate(14deg);
    }

    27% {
        transform: rotate(-12deg);
    }

    29% {
        transform: rotate(10deg);
    }

    31% {
        transform: rotate(-8deg);
    }

    33% {
        transform: rotate(6deg);
    }

    35% {
        transform: rotate(-4deg);
    }

    37% {
        transform: rotate(2deg);
    }

    39% {
        transform: rotate(-1deg);
    }

    41% {
        transform: rotate(1deg);
    }

    43% {
        transform: rotate(0);
    }

    100% {
        transform: rotate(0);
    }
}

.main-section {
    display: flex;
}

.card-header {
    display: flex;
    align-items: center;
}

.team-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
}

.team-logo {
    height: 2.5rem;
    width: 2.5rem;
}

.teams-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.game-status {
    display: flex;
}

.clock {
    font-weight: 600;
}

.clock.active {
    color: var(--q-primary);
}

.scores-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-left: 1rem;
}

.scores-container,
.time-periods {
    display: grid;
    grid-template-columns: repeat(auto-fit, 2rem);
    align-items: center;
    text-align: center;
    justify-content: right;
    gap: 1rem;
}

.score {
    font-weight: 600;
    font-size: 1.5rem;
}

.score.winning {
    color: var(--q-primary);
}

.leaders-header {
    display: flex;
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
}

.leaders-section {
    display: flex;
    flex-direction: column;
    padding-top: 0rem;
}

.leaders {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}

.headshot {
    height: 3rem;
    width: 3.5rem;
}

.leader {
    display: flex;
    flex-direction: row;
}

.leader-info {
    display: flex;
    flex-direction: column;
}
</style>
