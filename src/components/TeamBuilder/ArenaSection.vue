<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { WESTERN_TEAMS, EASTERN_TEAMS } from "@/constants/constants";
import type { DrawerSide } from "@/constants/constants";
import type { Arena } from "@/lib/types";
import arenaData from "@/assets/arenas.json";

const props = defineProps<{
  teamArena: any;
}>();
const emit = defineEmits(["update:teamArena"]);

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

const showArenaDrawer = ref<boolean>(false);

const search = ref<string>("");
const searchLoading = ref<boolean>(false);
/* Typing guide: https://vuejs.org/guide/typescript/composition-api.html */
const cardsFlipped = ref<Map<any, boolean>>(new Map());
const sortOptions = [
  "Alphabetic (A-Z)",
  "Reverse Alphabetic (Z-A)",
  "Capacity (Low-High)",
  "Capacity (High-Low)",
];
const selectedDrawerSide = ref<any>("right");
/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const ARENA_FILTERS = ["Western Conference", "Eastern Conference"];


/* Computed Props */

const sortedArenaData = computed(() => {
  const copyArenaData = [...typedArenaData];

  switch (selectedSort.value) {
    case "Alphabetic (A-Z)":
      return copyArenaData.sort((a: Arena, b: Arena) => {
        return a.name.localeCompare(b.name);
      });
    case "Reverse Alphabetic (Z-A)":
      return copyArenaData.sort((a: Arena, b: Arena) => {
        return b.name.localeCompare(a.name);
      });
    case "Capacity (Low-High)":
      return copyArenaData.sort((a: Arena, b: Arena) => {
        const capacityA = parseInt(a.capacity.replace(",", ""));
        const capacityB = parseInt(b.capacity.replace(",", ""));
        return capacityA - capacityB;
      });
    case "Capacity (High-Low)":
      return copyArenaData.sort((a: Arena, b: Arena) => {
        const capacityA = parseInt(a.capacity.replace(",", ""));
        const capacityB = parseInt(b.capacity.replace(",", ""));
        return capacityB - capacityA;
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

// const flipCard = (n: number) => {
//   const isFlipped = cardsFlipped.value.get(n);
//   console.log("Flipping card: ", !isFlipped);
//   cardsFlipped.value.set(n, !isFlipped);

//   if (!isFlipped) {
//     showTransition.value = true;
//     setTimeout(() => {
//       showTransition.value = false;
//     }, 400);
//   }
// };

/* Arena Select Logic */
const setArena = (arena: any) => {
  localTeamArena.value = arena;
};

const deleteArena = () => {
  localTeamArena.value = null;
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
          @click="showArenaDrawer = true"
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
      v-model="showArenaDrawer"
      :side="selectedDrawerSide"
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
            @click="showArenaDrawer = false"
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
          />
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
