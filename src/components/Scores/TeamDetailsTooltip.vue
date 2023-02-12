<script setup lang="ts">
import { ref, computed } from 'vue'
import {
    HOME,
    HOME_C,
    AWAY,
    AWAY_C
} from "@/constants/constants";

const props = defineProps<{
    data: any;
    homeAway: string;
}>();

console.log("Data in TeamDetailsTooltip = ", props.data);

const overallRecordStats = computed(() => props.data.record.items[0].stats);
const homeRecord = computed(() => props.data.record.items[1]);
const awayRecord = computed(() => props.data.record.items[2]);

const getColorClass = (condition: boolean) => {
    return condition ? "positive" : "negative";
}

const roundValueToNPlaces = (value: any, n: number = 1) => {
    return Number(value).toFixed(n);
}

const streak = computed(() => {
    const {value: streak} = overallRecordStats.value[14];
    const losingMessage = `Streak: L${streak.toString().replace("-", "")}`;
    const condition = streak >= 0;
    const message = condition ? `Streak: W${streak}` : losingMessage;
    const colorClass = getColorClass(condition);
    return {
        message,
        positive: colorClass,
    }
})

const playoffSeed = computed(() => {
    const {value: playoffSeed} = overallRecordStats.value[10];
    const message = `Seed: ${playoffSeed}`;    
    const inPlayIn = playoffSeed <= 10;
    const colorClass = getColorClass(inPlayIn);
    return {
        message,
        positive: colorClass,
    }
})

const standingSummary = computed(() =>`${props.data.standingSummary}\n`);

const overallWinPercent = computed(() => {
    const winPercent = roundValueToNPlaces(overallRecordStats.value[16].value * 100);
    return `Overall Win Pct: ${winPercent}%`;
})

const homeAwayWinPercent = computed(() => {
    const homeAwayPrefix = props.homeAway === HOME ? HOME_C : AWAY_C;
    const recordToCheck = props.homeAway === HOME ? homeRecord.value : awayRecord.value;
    const winPercent =  roundValueToNPlaces(recordToCheck.stats[3].value * 100);
    return `${homeAwayPrefix} Win Pct: ${winPercent}%`;
})


const gamesBehind = computed(() => {
    const gamesBehind = overallRecordStats.value[6].value;
    return `Games Behind 1st: ${gamesBehind}`;
})

const pointDifferential = computed(() => {
    const pointDifferential = roundValueToNPlaces(overallRecordStats.value[4].value, 2); +Number(overallRecordStats.value[4].value).toFixed(2);
    return `Point Differential: ${pointDifferential}`;
});

</script>


<template>
    <q-tooltip anchor="center right" self="bottom middle" :offset="[10, 10]">
        <div class="tooltip-info">
            <div>{{ standingSummary }}</div>
            <div :class="streak.positive">{{ streak.message }}</div>
            <div :class="playoffSeed.positive">{{ playoffSeed.message }}</div>
            <div>{{ overallWinPercent }}</div>
            <div>{{ homeAwayWinPercent }}</div>
            <div>{{ gamesBehind }}</div>
            <div>{{ pointDifferential }}</div>
        </div>
    </q-tooltip>
</template>

<style>
    .tooltip-info {
        white-space: pre-line;
        font-size: 0.7rem;
    }

    .positive {
        color: var(--q-positive);
        font-weight: 600;
    }

    .negative {
        color: var(--q-negative);
        font-weight: 600;
    }

</style>