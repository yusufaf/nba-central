<script setup lang="ts">
import { ref, watch } from "vue";
import {} from "@/constants/constants";
import PlayerStatsDialog from "./PlayerStatsDialog.vue";

const props = defineProps<{
  player1Data: any;
  player2Data: any;
}>();

/* https://stackoverflow.com/questions/42737034/vue-js-watch-multiple-properties-with-single-handler */
// watch([() => props.player1Data, () => props.player2Data],
//       ([newPlayer1Data, newPlayer2Data], [oldPlayer1Data, oldPlayer2Data]) => {
//         // Do something with the new values of player1Data and player2Data
//         console.log({newPlayer1Data, newPlayer2Data})
//       },
//       { immediate: true}
//     );

</script>

<template>
  <PlayerStatsDialog :data="props.player1Data" :visible="true" />
  <PlayerStatsDialog :data="props.player2Data" :visible="true" />
</template>

<style></style>
