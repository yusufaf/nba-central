<script setup lang="tsx">
import { ref, computed } from 'vue'

const props = defineProps<{
    team: any,
}>()

/* TODO: Need to work on this when games are actually going on and see what the data looks like */
const headerValues = computed(() => {
    const headerVals: any[] = [...Array(4).keys()].map(i => i + 1);
    headerVals.push("T");
    const linescores = props.team.linescores;
    if (linescores.length > 4) {
        const index = 4;
        headerVals.splice(index, 0, "OT")
    }
    return headerVals;
})

const getLineScore = (team: any) => {
    /* One div for => 1 2 3 4 (OT) T */
    const { linescores, score } = team;

}
</script>

<template>
    <div >{{ headerValues.join(" ") }}</div>
</template>

<style scoped>

</style>
