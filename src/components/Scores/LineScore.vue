<script setup lang="tsx">
import { computed } from "vue";

const props = defineProps<{
    team: any;
    numberOfTimePeriods: number;
}>();

/* TODO: Need to work on this when games are actually going on and see what the data looks like */

const lineScore = computed(() => {
    const lineScores = props.team.linescores;
    const numberOfTimePeriods = props.numberOfTimePeriods;
    if (!lineScores) {
        return [];
    }

    const scores = lineScores.map((score: any) => score.value);

    /* 
        If the length of scores is less than numberOfTimePeriods, pad the array with empty strings
        TODO: Re-visit scores section CSS to see if this is unnecessary
    */
    if (scores.length < numberOfTimePeriods) {
        const paddingLength = numberOfTimePeriods - scores.length;
        const paddingArray = Array(paddingLength).fill("");
        return scores.concat(paddingArray);
    }

    return scores;
});
</script>

<template>
    <div class="score-value" v-for="(score, index) in lineScore" :key="index">
        {{ score }}
    </div>
</template>

<style>
.score-value {
    font-size: 1.5rem;
}
</style>
