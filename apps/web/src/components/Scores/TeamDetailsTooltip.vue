<script setup lang="ts">
import { ref, computed } from 'vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    HOME,
    HOME_C,
    AWAY,
    AWAY_C
} from "@/constants/constants";

const props = defineProps<{
    competitorId: string;
    homeAway: string;
}>();

const tooltipData = ref<any>(null);
const isLoading = ref(false);

const fetchTooltipData = async () => {
    if (tooltipData.value || isLoading.value) return;

    isLoading.value = true;
    const teamURL = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${props.competitorId}`;

    try {
        const response = await fetch(teamURL, { method: "GET" });
        const res = await response.json();
        tooltipData.value = res.team;
    } catch (err) {
        console.error(err);
    } finally {
        isLoading.value = false;
    }
};

const overallRecordStats = computed(() => tooltipData.value?.record?.items[0]?.stats);
const homeRecord = computed(() => tooltipData.value?.record?.items[1]);
const awayRecord = computed(() => tooltipData.value?.record?.items[2]);

const getColorClass = (condition: boolean) => {
    return condition ? "positive" : "negative";
}

const roundValueToNPlaces = (value: any, n: number = 1) => {
    return Number(value).toFixed(n);
}

const streak = computed(() => {
    if (!overallRecordStats.value?.[14]) return null;
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
    if (!overallRecordStats.value?.[10]) return null;
    const {value: playoffSeed} = overallRecordStats.value[10];
    const message = `Seed: ${playoffSeed}`;
    const inPlayIn = playoffSeed <= 10;
    const colorClass = getColorClass(inPlayIn);
    return {
        message,
        positive: colorClass,
    }
})

const standingSummary = computed(() => tooltipData.value?.standingSummary ? `${tooltipData.value.standingSummary}\n` : '');

const overallWinPercent = computed(() => {
    if (!overallRecordStats.value?.[16]) return '';
    const winPercent = roundValueToNPlaces(overallRecordStats.value[16].value * 100);
    return `Overall Win Pct: ${winPercent}%`;
})

const homeAwayWinPercent = computed(() => {
    const homeAwayPrefix = props.homeAway === HOME ? HOME_C : AWAY_C;
    const recordToCheck = props.homeAway === HOME ? homeRecord.value : awayRecord.value;
    if (!recordToCheck?.stats?.[3]) return '';
    const winPercent =  roundValueToNPlaces(recordToCheck.stats[3].value * 100);
    return `${homeAwayPrefix} Win Pct: ${winPercent}%`;
})


const gamesBehind = computed(() => {
    if (!overallRecordStats.value?.[6]) return '';
    const gamesBehind = overallRecordStats.value[6].value;
    return `Games Behind 1st: ${gamesBehind}`;
})

const pointDifferential = computed(() => {
    if (!overallRecordStats.value?.[4]) return '';
    const pointDifferential = roundValueToNPlaces(overallRecordStats.value[4].value, 2);
    return `Point Differential: ${pointDifferential}`;
});

</script>

<template>
    <TooltipProvider>
        <Tooltip @update:open="(open) => open && fetchTooltipData()">
            <TooltipTrigger as-child>
                <slot />
            </TooltipTrigger>
            <TooltipContent side="right" align="center" :side-offset="10">
                <div v-if="isLoading" class="tooltip-info">Loading...</div>
                <div v-else-if="tooltipData" class="tooltip-info">
                    <div>{{ standingSummary }}</div>
                    <div v-if="streak" :class="streak.positive">{{ streak.message }}</div>
                    <div v-if="playoffSeed" :class="playoffSeed.positive">{{ playoffSeed.message }}</div>
                    <div>{{ overallWinPercent }}</div>
                    <div>{{ homeAwayWinPercent }}</div>
                    <div>{{ gamesBehind }}</div>
                    <div>{{ pointDifferential }}</div>
                </div>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>

<style>
    .tooltip-info {
        white-space: pre-line;
        font-size: 0.7rem;
    }

    .positive {
        color: hsl(var(--success));
        font-weight: 600;
    }

    .negative {
        color: hsl(var(--destructive));
        font-weight: 600;
    }
</style>
