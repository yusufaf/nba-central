<script setup lang="ts">
import { ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  data: any;
  visible: boolean;
}>();

const localVisible = ref(props.visible);
const localData = ref(props.data);

const emit = defineEmits(['update:visible']);

watch(localVisible, (newVisible) => {
  emit("update:visible", newVisible);
});

watch(() => props.visible, (value) => {
  localVisible.value = value;
});

watch(() => props.data, (value) => {
  localData.value = value;
});

const onClose = () => {
  localVisible.value = false;
};

const columns = ref<any[]>([
  { name: 'games_played', label: 'Games Played', field: 'games_played', sortable: true},
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
  <Dialog v-model:open="localVisible">
    <DialogContent class="max-w-7xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Player Stats</DialogTitle>
      </DialogHeader>

      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="column in columns"
                :key="column.name"
                class="text-white"
              >
                {{ column.label }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(row, index) in localData"
              :key="row.id || index"
              class="border-gray-700"
            >
              <TableCell
                v-for="column in columns"
                :key="column.name"
                class="text-gray-300"
              >
                {{ row[column.field] }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="onClose">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
