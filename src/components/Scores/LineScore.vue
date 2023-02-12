<script setup lang="tsx">
import { ref, computed } from 'vue'

const props = defineProps<{
    team: any,
}>()

/* TODO: Need to work on this when games are actually going on and see what the data looks like */


const lineScore = computed(() => {
    const lineScores = props.team.linescores;
    if (lineScores === undefined) {
        return [];
    }
    else {
        return props.team.linescores.map((score: any) => score.value);
    }
})

</script>

<template>
    <div class="line-scores">
        <div class="score-value" v-for="(score, index) in lineScore" :key="index">{{ score }}</div>
    </div>
</template>

<style scoped>
.line-scores {
    display: flex;
    flex-direction: row;
    gap: 2rem;
    margin-left: auto;
    /* justify-content: center; */
}

.score-value {
    display: flex;
}

</style>
