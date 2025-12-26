<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { debounce } from 'quasar';
import axios from 'axios';
import type { DrawerSide } from '@/models/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BDL_API_PREFIX } from '@/constants/constants';
import {
  Search,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-vue-next';

interface Props {
  open: boolean;
  position?: string;
  slotIndex?: number;
  selectedDrawerSide: DrawerSide;
}

const props = withDefaults(defineProps<Props>(), {
  position: undefined,
  slotIndex: undefined,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  'select': [player: any];
}>();

const search = ref('');
const searchList = ref<any[]>([]);
const searchLoading = ref(false);
const selectedPosition = ref<string>('All');
const selectedSort = ref<string>('');
const sortDirection = ref<'asc' | 'desc'>('asc');

const POSITION_FILTERS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];
const SORT_OPTIONS = ['Alphabetic', 'Team Name'];

const sheetModel = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
};

const searchListResults = computed(() => {
  let results = searchList.value.map((player: any) => {
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
        : 'N/A';
    const weightString = weight_pounds ? `${weight_pounds}lbs` : 'N/A';
    const heightAndWeight = `${heightString}, ${weightString}`;
    return {
      ...player,
      fullName,
      heightAndWeight,
    };
  });

  // Filter by position
  if (selectedPosition.value && selectedPosition.value !== 'All') {
    results = results.filter(p => p.position === selectedPosition.value);
  }

  // Sort
  const sortModifier = sortDirection.value === 'asc' ? 1 : -1;

  if (selectedSort.value === 'Alphabetic') {
    results.sort((a, b) => sortModifier * a.fullName.localeCompare(b.fullName));
  } else if (selectedSort.value === 'Team Name') {
    results.sort((a, b) => sortModifier * a.team.full_name.localeCompare(b.team.full_name));
  }

  return results;
});

watch(
  search,
  debounce(async () => {
    const searchedPlayer = search.value;

    if (searchedPlayer) {
      searchLoading.value = true;
      searchList.value = [];

      try {
        let next_page = null;
        do {
          const page: number | null = next_page ? next_page : '';
          const response: any = await axios.get(
            `${BDL_API_PREFIX}/players?per_page=50&search=${searchedPlayer}&page=${page}`,
          );
          const { data, meta } = response.data;
          next_page = meta.next_page;
          searchList.value = [...searchList.value, ...data];
        } while (next_page != null);
      } catch (error) {
        console.error('Error searching players: ', error);
      } finally {
        searchLoading.value = false;
      }
    } else {
      searchList.value = [];
    }
  }, 600),
);

const handleSelect = (player: any) => {
  emit('select', player);
  sheetModel.value = false;
  search.value = '';
  searchList.value = [];
};

const getPlayerInitials = (player: any) => {
  return `${player.first_name[0]}${player.last_name[0]}`;
};
</script>

<template>
  <Sheet v-model:open="sheetModel">
    <SheetContent
      :side="props.selectedDrawerSide"
      class="w-96 overflow-y-auto"
    >
      <SheetHeader class="pr-12 pb-4 border-b border-primary/20">
        <SheetTitle class="text-white text-2xl font-bold">
          Add Player
          <span v-if="position" class="text-primary"> - {{ position }}</span>
        </SheetTitle>
        <p class="text-sm text-muted-foreground/80 mt-2">Search and select a player for your team</p>
      </SheetHeader>

      <div class="drawer-header mt-5 space-y-4 px-1">
        <div class="relative group mb-6">
          <Input
            v-model="search"
            placeholder="Search for a player..."
            type="search"
            class="pr-10 h-12 border-2 border-primary/30 bg-background/50 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
          />
          <Search class="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary group-focus-within:text-primary transition-colors" />
        </div>

        <div class="flex items-center gap-3 p-3 rounded-lg bg-background/30 border border-border/30">
          <Button
            @click="toggleSortDirection"
            size="icon"
            variant="outline"
            class="shrink-0 h-11 w-11 border-2 border-primary/50 bg-primary/10 hover:bg-primary/25 hover:border-primary shadow-sm transition-all"
          >
            <ArrowUp v-if="sortDirection === 'asc'" class="h-5 w-5 text-primary" />
            <ArrowDown v-else class="h-5 w-5 text-primary" />
          </Button>
          <div class="flex-1">
            <Select v-model="selectedSort">
              <SelectTrigger class="border-2 border-primary/40 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/30 hover:border-primary/60 transition-colors">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent class="bg-background/98 backdrop-blur-md border-2 border-primary shadow-lg shadow-primary/20">
                <SelectItem
                  v-for="option in SORT_OPTIONS"
                  :key="option"
                  :value="option"
                  class="focus:bg-primary/20 focus:text-primary hover:bg-primary/15 cursor-pointer data-[highlighted]:bg-primary/20 data-[highlighted]:text-primary"
                >
                  {{ option }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-background/30 border border-border/30">
          <Select v-model="selectedPosition">
            <SelectTrigger class="border-2 border-primary/40 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/30 hover:border-primary/60 transition-colors">
              <SelectValue placeholder="Filter by position..." />
            </SelectTrigger>
            <SelectContent class="bg-background/98 backdrop-blur-md border-2 border-primary shadow-lg shadow-primary/20">
              <SelectItem
                v-for="pos in POSITION_FILTERS"
                :key="pos"
                :value="pos"
                class="focus:bg-primary/20 focus:text-primary hover:bg-primary/15 cursor-pointer data-[highlighted]:bg-primary/20 data-[highlighted]:text-primary"
              >
                {{ pos === 'All' ? 'All Positions' : pos }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator class="my-5 bg-primary/20" />

      <ScrollArea class="h-[calc(100vh-22rem)]">
        <div v-if="searchLoading" class="flex items-center justify-center py-16 px-6">
          <div class="text-center">
            <div class="relative inline-block mb-3">
              <div class="animate-spin rounded-full h-10 w-10 border-4 border-primary/30 border-t-primary"></div>
            </div>
            <p class="text-sm text-muted-foreground font-medium">Searching for players...</p>
          </div>
        </div>

        <div v-else-if="!search" class="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div class="rounded-full bg-primary/10 p-5 mb-3">
            <Search class="h-10 w-10 text-primary" />
          </div>
          <p class="text-base text-foreground font-semibold leading-none">Start Your Search</p>
          <p class="text-xs text-muted-foreground/70 mt-0.5">Type a player name to begin</p>
        </div>

        <div v-else-if="searchListResults.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div class="rounded-full bg-primary/10 p-5 mb-3">
            <Search class="h-10 w-10 text-primary" />
          </div>
          <p class="text-base text-foreground font-semibold leading-none">No Players Found</p>
          <p class="text-xs text-muted-foreground/70 mt-0.5">Try adjusting your search or filters</p>
        </div>

        <div v-else class="space-y-3 pb-6 px-1">
          <div
            v-for="player in searchListResults"
            :key="player.id"
            @click="handleSelect(player)"
            class="player-item p-4 cursor-pointer rounded-xl transition-all flex items-center gap-4 hover:bg-primary/15 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98]"
          >
            <Avatar class="h-14 w-14 border-2 border-primary shrink-0 shadow-md">
              <AvatarFallback class="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-lg">
                {{ getPlayerInitials(player) }}
              </AvatarFallback>
            </Avatar>

            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-base truncate text-foreground mb-0.5">
                {{ player.fullName }}
              </h4>
              <p class="text-sm text-muted-foreground truncate mb-2">
                {{ player.team.full_name }}
              </p>
              <div class="flex items-center gap-2">
                <Badge variant="secondary" class="text-xs font-semibold bg-primary/25 text-primary border border-primary/40 px-2 py-0.5">
                  {{ player.position }}
                </Badge>
                <span class="text-xs text-muted-foreground font-medium">
                  {{ player.heightAndWeight }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.player-item {
  border: 2px solid hsl(var(--border) / 0.4);
  background: linear-gradient(to right, hsl(var(--background) / 0.6), hsl(var(--background) / 0.3));
}

.player-item:hover {
  transform: translateX(4px);
}
</style>
