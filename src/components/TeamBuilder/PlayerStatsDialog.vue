<script setup lang="ts">
import { ref, watch } from "vue";
import {} from "@/constants/constants";

const props = defineProps<{
  data: any;
  visible: boolean;
}>();

const localVisible = ref(props.visible);
const localData = ref(props.data);

const emit = defineEmits(['visibleChange']);

watch(() => props.visible, (value) => {
  localVisible.value = value;
});

watch(() => props.data, (value) => {
  localData.value = value;
});


const onClose = () => {
  emit("visibleChange", false);
};

const columns = ref<any[]>([
  { name: 'games_played', label: 'Games Played', field: 'games_played', sortable: true},
  { name: 'player_id', label: 'Player ID', field: 'player_id' },
  { name: 'id', label: 'ID', field: 'id' },
  { name: 'season', label: 'Season', field: 'season' , sortable: true},
  { name: 'min', label: 'Minutes', field: 'min' , sortable: true},
  { name: 'fgm', label: 'FG Made', field: 'fgm', sortable: true },
  { name: 'fga', label: 'FG Attempted', field: 'fga', sortable: true },
  { name: 'fg_pct', label: 'FG%', field: 'fg_pct', sortable: true },
  { name: 'fg3m', label: '3PT Made', field: 'fg3m', sortable: true },
  { name: 'fg3a', label: '3PT Attempted', field: 'fg3a', sortable: true },
  { name: 'fg3_pct', label: '3PT%', field: 'fg3_pct', sortable: true },
  { name: 'ftm', label: 'FT Made', field: 'ftm', sortable: true },
  { name: 'fta', label: 'FT Attempted', field: 'fta', sortable: true },
  { name: 'ft_pct', label: 'FT%', field: 'ft_pct', sortable: true },
  { name: 'oreb', label: 'Offensive Rebounds', field: 'oreb' },
  { name: 'dreb', label: 'Defensive Rebounds', field: 'dreb' },
  { name: 'reb', label: 'Total Rebounds', field: 'reb', sortable: true },
  { name: 'ast', label: 'Assists', field: 'ast', sortable: true },
  { name: 'stl', label: 'Steals', field: 'stl', sortable: true },
  { name: 'blk', label: 'Blocks', field: 'blk', sortable: true },
  { name: 'turnover', label: 'Turnovers', field: 'turnover', sortable: true },
  { name: 'pf', label: 'Personal Fouls', field: 'pf', sortable: true },
  { name: 'pts', label: 'Points', field: 'pts', sortable: true },
]);
</script>

<template>
  <q-dialog v-model="localVisible" >
    <q-card class="my-card" dark>
      <q-card-section>
        <div class="text-h6">Player Stats</div>
      </q-card-section>
      <q-card-section>
        <q-table
          :rows="localData"
          :columns="columns"
          row-key="id"
          dark
        >
        </q-table>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Close" @click="onClose" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
