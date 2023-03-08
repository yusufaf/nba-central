<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { BDL_API_PREFIX, VIEWS } from "@/constants/constants";
import type { DrawerSide } from "@/constants/constants";
import type { Coach } from "@/lib/types";
import axios from "axios";
import coachesData from "@/assets/coaches.json";
import { roundValueToNPlaces } from "@/constants/functions";

const props = defineProps<{
  teamArena: Coach | null;
}>();
const emit = defineEmits(["update:teamArena"]);

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
const showTransition = ref(false);
const sortOptions = ["Alphabetic (A-Z)", "Reverse Alphabetic (Z-A)"];
const selectedDrawerSide = ref<DrawerSide>("right");
/* Sorting and Filtering */
const showSortDropdown = ref<boolean>(false);
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const COACH_FILTERS = ["Current Season Only", "Hall of Famer"];

/* Computed Props */

const flipCard = (n: number) => {
  const isFlipped = cardsFlipped.value.get(n);
  console.log("Flipping card: ", !isFlipped);
  cardsFlipped.value.set(n, !isFlipped);

  if (!isFlipped) {
    showTransition.value = true;
    setTimeout(() => {
      showTransition.value = false;
    }, 400);
  }
};

/* Coach Select Logic */
const setArena = (coach: any) => {
  localTeamArena.value = coach;
};

const deleteArena = () => {
  localTeamArena.value = null;
};

const coachWinPercent = (wlPercent: string | number) => {
  if (typeof wlPercent === "number") {
    return `0%`;
  }

  return `${roundValueToNPlaces(parseFloat(wlPercent) * 100, 1)}%`;
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
          <q-icon class="blank-avatar" name="account_circle" size="3.5rem" />
          <div>{{ teamArena.name ?? "" }}</div>
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
          placeholder="Search for a coach"
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
          <div class="coach-filter-container">
            <q-btn color="primary" label="Filters Menu">
              <q-menu dark>
                <q-list style="min-width: 100px">
                  <template
                    v-for="(filter, index) in COACH_FILTERS"
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
            <span class="hof-coach"> * = Hall of Fame </span>
          </div>
        </div>
      </div>
      <q-separator dark />
      <q-scroll-area class="fit">
        <q-list>
          <template v-for="(arena, index) in Array(5)" :key="index">
            <q-item @click="() => setArena(arena)" clickable v-ripple>
              <q-item-section class="coach-item">
                <div>
                  <div class="coach-name">{{ }}</div>
                  <div>
                    {{  }}
                  </div>
                  <div>
                    {{ }}
                  </div>
                  <div>
                    {{  }}
                  </div>
                </div>
                <div>
                  <div>{{ }}</div>
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

.coach-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.coach-name {
  font-weight: 600;
}

.coach-filter-container {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.hof-coach {
  margin-left: auto;
  margin-right: 0.5rem;
  font-weight: 600;
}
</style>
