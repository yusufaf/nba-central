<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { DrawerSide } from "@/constants/constants";
import type { Coach, SortDirection } from "@/lib/types";
import coachesData from "@/assets/coaches.json";
import { roundValueToNPlaces } from "@/constants/functions";
import { debounce } from "quasar";

const props = defineProps<{
  teamCoach: Coach | null;
  showCoachDrawer: boolean;
  selectedDrawerSide: any;
}>();
const emit = defineEmits(["update:teamCoach", "update:showCoachDrawer"]);

const typedCoachesData = coachesData as Coach[];

const localDrawerSide = ref<any>(props.selectedDrawerSide);

/* Watchers */
watch(
  () => props.selectedDrawerSide,
  (newVal) => {
    localDrawerSide.value = newVal;
  }
);

const localShowCoachDrawer = computed({
  get() {
    return props.showCoachDrawer;
  },
  set(value) {
    emit("update:showCoachDrawer", value);
  },
});

/* Note: Good pattern for creating a two-way bound value in child component */
const localTeamCoach = computed({
  get() {
    return props.teamCoach;
  },
  set(value) {
    emit("update:teamCoach", value);
  },
});

const search = ref<string>("");
const searchLoading = ref<boolean>(false);

const sortOptions = [
  "Alphabetic",
  "Win Percentage",
  "Playoff Win Percentage",
  "Championships",
  "Years Coached",
  "Year Started Coaching",
];

/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const COACH_FILTERS = ["Current Season Only", "Hall of Famer"];

const sortDirection = ref<SortDirection>("asc");

const cleanCoachesData = typedCoachesData.map((coach: Coach) => {
  const {
    l,
    w,
    wlPercent,
    playoffW,
    playoffL,
    playoffWLPercent,
    championships,
    confTitles,
    from,
    to,
  } = coach;

  return {
    ...coach,
    generalRecord: `Record: ${w} - ${l}, ${coachWinPercent(wlPercent)}`,
    playoffRecord: `Playoffs: ${playoffW} - ${playoffL}, ${coachWinPercent(
      playoffWLPercent
    )}`,
    champsCount: `Championships: ${championships}, Conf: ${confTitles}`,
    yearsCoached: `Years Coached: ${from} - ${to}`,
  };
});

/* Computed Props */
const sortedCoachesData = computed(() => {
  const copyCoachData = [...cleanCoachesData];

  const sortModifier = sortDirection.value === "asc" ? 1 : -1;

  switch (selectedSort.value) {
    case "Alphabetic":
      return copyCoachData.sort((a: Coach, b: Coach) => {
        return sortModifier * a.name.localeCompare(b.name);
      });
    case "Win Percentage":
      return copyCoachData.sort((a: Coach, b: Coach) => {
        const result = parseFloat(a.wlPercent) - parseFloat(b.wlPercent);
        return sortModifier * result;
      });
    case "Playoff Win Percentage":
      return copyCoachData.sort((a: Coach, b: Coach) => {
        const result =
          parseFloat(a.playoffWLPercent) - parseFloat(b.playoffWLPercent);
        return sortModifier * result;
      });
    case "Championships":
      return copyCoachData.sort((a: Coach, b: Coach) => {
        const result = a.championships - b.championships;
        return sortModifier * result;
      });
    case "Years Coached":
      return copyCoachData.sort((a: Coach, b: Coach) => {
        const aDiff = a.to - a.from;
        const bDIff = b.to - b.from;
        return sortModifier * (aDiff - bDIff);
      });
    case "Year Started Coaching":
      return copyCoachData.sort((a: Coach, b: Coach) => {
        return sortModifier * (a.from - b.from);
      });
    default:
      return cleanCoachesData;
  }
});

const filteredCoachesData = computed({
  // Getter
  get() {
    const copyCoachData = [...sortedCoachesData.value];

    /* If no filters, return regular sorted data */
    if (selectedFilters.value.length === 0) {
      return copyCoachData;
    }

    return copyCoachData.filter((coach: Coach) => {
      const { name } = coach;
      const isHallOfFamer = name.endsWith("*");

      if (selectedFilters.value.includes("Hall of Famer")) {
        if (!isHallOfFamer) {
          return false;
        }
      }
      return true;
    });
  },
  // Setter
  set(value) {
    filteredCoachesData.value = value;
  }
});


/* Searching */
// watch(
//   search,
//   debounce(async () => {
//     const searchedCoach = search.value;
//     console.log({searchedCoach})
//     if (searchedCoach) {
//       const searchedCoachLower = searchedCoach.toLowerCase();
//       const searchedFilteredData = [...filteredCoachesData.value].filter((value: Coach) => {
//           const nameLower = value.name.toLowerCase();
//           return nameLower.includes(searchedCoachLower);
//       })
//       filteredCoachesData.value = searchedFilteredData;
//     }
//   }, 600)
// );


const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
};

/* Coach Select Logic */
const setCoach = (coach: any) => {
  localTeamCoach.value = coach;
};

const deleteCoach = () => {
  localTeamCoach.value = null;
};

function coachWinPercent(wlPercent: string | number) {
  if (typeof wlPercent === "number") {
    return `0%`;
  }

  return `${roundValueToNPlaces(parseFloat(wlPercent) * 100, 1)}%`;
}

const selectRandomCoach = () => {
  const copyCoachData = filteredCoachesData.value;
  const randomIndex = Math.floor(Math.random() * copyCoachData.length);
  localTeamCoach.value = copyCoachData[randomIndex];
};
</script>

<template>
  <div>
    <h6 class="section-header">Coach</h6>
    <q-card dark class="coach-card" bordered>
      <q-card-section>
        <h6>Coach</h6>
      </q-card-section>
      <q-separator />
      <q-card-section class="main-card-section">
        <q-btn
          v-if="!teamCoach"
          round
          icon="add_circle"
          size="1.75rem"
          @click="localShowCoachDrawer = true"
        />
        <template v-else>
          <q-icon class="blank-avatar" name="account_circle" size="3.5rem" />
          <div>{{ teamCoach.name ?? "" }}</div>
        </template>
      </q-card-section>
      <q-separator dark />
      <q-card-actions>
        <q-btn @click="deleteCoach" flat round icon="delete" color="negative" />
      </q-card-actions>
    </q-card>
    <q-drawer
      v-model="localShowCoachDrawer"
      :side="localDrawerSide"
      :width="300"
      bordered
      elevated
      overlay
      dark
    >
      <div class="drawer-header">
        <div class="drawer-title-container">
          <h6 class="drawer-title">Add Coach</h6>
          <q-btn
            @click="localShowCoachDrawer = false"
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
            class="sort-select"
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
          <div class="coach-filter-container">
            <div class="coach-filter-buttons">
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
              <q-btn
                icon="shuffle"
                round
                color="primary"
                title="Select random coach"
                @click="selectRandomCoach"
              />
              <span class="hof-coach"> * = Hall of Fame </span>
            </div>
          </div>
        </div>
      </div>
      <q-separator dark />
      <q-scroll-area class="fit">
        <q-virtual-scroll
          style="max-height: 600px"
          :items="filteredCoachesData"
          v-slot="{ item: coach }"
          separator
        >
          <q-item
            :key="coach.rank"
            @click="() => setCoach(coach)"
            clickable
            v-ripple
          >
            <q-item-section class="coach-item">
              <div>
                <div class="coach-name">{{ coach.name }}</div>
                <div>
                  {{ coach.generalRecord }}
                </div>
                <div>
                  {{ coach.playoffRecord }}
                </div>
                <div>
                  {{ coach.champsCount }}
                </div>
              </div>
              <div>
                <div>{{ coach.yearsCoached }}</div>
              </div>
            </q-item-section>
          </q-item>
        </q-virtual-scroll>
      </q-scroll-area>
    </q-drawer>
  </div>
</template>

<style scoped>
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
  flex-direction: column;
}

.coach-filter-buttons {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.hof-coach {
  /* margin-left: auto; */
  margin-right: 0.5rem;
  font-weight: 600;
}
</style>
