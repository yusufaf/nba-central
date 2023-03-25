<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { WESTERN_TEAMS, EASTERN_TEAMS } from "@/constants/constants";
import type { Arena, SortDirection } from "@/lib/types";
import arenaData from "@/assets/arenas.json";

const props = defineProps<{
  teamArena: any;
  selectedDrawerSide: any;
  showArenaDrawer: boolean;
}>();

const emit = defineEmits(["update:teamArena", "update:showArenaDrawer"]);

const typedArenaData = arenaData as Arena[];

/* Note: Good pattern for creating a two-way bound value in child component */
const localTeamArena = computed({
  get() {
    return props.teamArena;
  },
  set(value) {
    emit("update:teamArena", value);
  },
});

const localShowArenaDrawer = computed({
  get() {
    return props.showArenaDrawer;
  },
  set(value) {
    emit("update:showArenaDrawer", value);
  },
});

const search = ref<string>("");
const searchLoading = ref<boolean>(false);
/* Typing guide: https://vuejs.org/guide/typescript/composition-api.html */
const cardsFlipped = ref<Map<any, boolean>>(new Map());

const sortOptions = ["Alphabetic", "Capacity "];

/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const ARENA_FILTERS = ["Western Conference", "Eastern Conference"];
const sortDirection = ref<SortDirection>("asc");

const localDrawerSide = ref<any>(props.selectedDrawerSide);

/* Watchers */
watch(
  () => props.selectedDrawerSide,
  (newVal) => {
    localDrawerSide.value = newVal;
  }
);

/* Computed Props */

const sortedArenaData = computed(() => {
  const copyArenaData = [...typedArenaData];

  const sortModifier = sortDirection.value === "asc" ? 1 : -1;

  switch (selectedSort.value) {
    case "Alphabetic":
      return copyArenaData.sort((a: Arena, b: Arena) => {
        return sortModifier * a.name.localeCompare(b.name);
      });
    case "Capacity":
      return copyArenaData.sort((a: Arena, b: Arena) => {
        const capacityA = parseInt(a.capacity.replace(",", ""));
        const capacityB = parseInt(b.capacity.replace(",", ""));
        return sortModifier * (capacityA - capacityB);
      });
    default:
      return typedArenaData;
  }
});

const filteredArenaData = computed(() => {
  const copyArenaData = [...sortedArenaData.value];

  /* If no filters, return regular sorted data */
  if (selectedFilters.value.length === 0) {
    return copyArenaData;
  }

  return copyArenaData.filter((arena: Arena) => {
    const { team } = arena;

    if (selectedFilters.value.includes("Western Conference")) {
      const isWesternTeam = WESTERN_TEAMS.includes(team);
      if (!isWesternTeam) {
        return false;
      }
    }

    if (selectedFilters.value.includes("Eastern Conference")) {
      const isEasternTeam = EASTERN_TEAMS.includes(team);
      if (!isEasternTeam) {
        return false;
      }
    }

    return true;
  });
});

const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
};

/* Arena Select Logic */
const setArena = (arena: any) => {
  localTeamArena.value = arena;
};

const deleteArena = () => {
  localTeamArena.value = null;
};

const selectRandomArena = () => {
  const copyArenaData = filteredArenaData.value;
  const randomIndex = Math.floor(Math.random() * copyArenaData.length);
  localTeamArena.value = copyArenaData[randomIndex];
};
</script>

<template>
  <div>
    <h6 class="section-header">Arena</h6>
    <q-card dark class="coach-card" bordered>
      <q-card-section>
        <h6>Arena</h6>
      </q-card-section>
      <q-separator />
      <q-card-section class="main-card-section">
        <q-btn
          v-if="!teamArena"
          round
          icon="add_circle"
          size="1.75rem"
          @click="localShowArenaDrawer = true"
        />
        <template v-else>
          <!-- TODO: Fix image width -->
          <img :src="teamArena.imgLink" height="100" width="150" />
          <div>{{ teamArena.name }}</div>
        </template>
      </q-card-section>
      <q-separator dark />
      <q-card-actions>
        <q-btn @click="deleteArena" flat round icon="delete" color="negative" />
      </q-card-actions>
    </q-card>
    <q-drawer
      v-model="localShowArenaDrawer"
      :side="localDrawerSide"
      :width="300"
      bordered
      elevated
      overlay
      dark
    >
      <div class="drawer-header">
        <div class="drawer-title-container">
          <h6 class="drawer-title">Add Arena</h6>
          <q-btn
            @click="localShowArenaDrawer = false"
            round
            icon="close"
            class="drawer-close"
          />
        </div>
        <q-input
          outlined
          v-model="search"
          placeholder="Search for an arena"
          type="search"
          dark
        >
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
        <q-linear-progress v-if="searchLoading" indeterminate color="primary" />
        <div>
          <q-select
            outlined
            v-model="selectedSort"
            :options="sortOptions"
            label="Sort"
            clearable
            dark
          >
            <template v-slot:prepend>
              <q-btn
                :icon="
                  sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'
                "
                @click.stop.prevent="toggleSortDirection"
                round
              />
            </template>
          </q-select>
          <div class="arena-filter-container">
            <q-btn color="primary" label="Filters Menu">
              <q-menu dark>
                <q-list style="min-width: 100px">
                  <template
                    v-for="(filter, index) in ARENA_FILTERS"
                    :key="index"
                  >
                    <q-item tag="label" avatar>
                      <q-item-section>
                        <q-checkbox
                          v-model="selectedFilters"
                          :val="filter"
                          dark
                        />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>{{ filter }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </q-menu>
            </q-btn>

            <q-btn
              icon="shuffle"
              round
              color="primary"
              title="Select random arena"
              @click="selectRandomArena"
            />
          </div>
        </div>
      </div>
      <q-separator dark />
      <q-scroll-area class="fit">
        <q-list>
          <template v-for="(arena, index) in filteredArenaData" :key="index">
            <q-item @click="() => setArena(arena)" clickable v-ripple>
              <q-item-section thumbnail>
                <img :src="arena.imgLink" height="50" width="75" />
              </q-item-section>
              <q-item-section class="arena-item">
                <div class="right">
                  <div class="arena-name">{{ arena.name }}</div>
                  <div>Capacity: {{ arena.capacity }}</div>
                  <div>Opened {{ arena.openedYear }}</div>
                </div>
              </q-item-section>
            </q-item>
            <q-separator />
          </template>
        </q-list>
      </q-scroll-area>
    </q-drawer>
  </div>
</template>

<style scoped>
.flip-enter-active,
.flip-leave-active {
  transition: all 0.4s ease;
}

.flip-enter,
.flip-leave-to {
  transform: rotateY(180deg);
  opacity: 0;
}

.flip-leave,
.flip-enter-to {
  transform: rotateY(0);
  opacity: 1;
}

.section-header {
  margin: 1rem 0;
}

::-webkit-scrollbar {
  display: none;
}

.main-card-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Drawer Styles */

/* Hide scrollbar in header section of drawer */
::v-deep .q-drawer__content.scroll {
  overflow: hidden;
}

.drawer-header {
  display: flex;
  flex-direction: column;
  /* height: fit-content; */
  overflow: hidden;
}

.drawer-title-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 1rem;
  margin-bottom: 0.5rem;
}

.q-drawer > .q-drawer__content {
  overflow: hidden;
}

.drawer-close {
  margin-left: auto;
}

.arena-filter-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.arena-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.arena-item .right {
  justify-content: right;
}

.arena-name {
  font-weight: 600;
}
</style>
