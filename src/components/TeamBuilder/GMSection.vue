<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { DrawerSide } from "@/constants/constants";
import type { GM, SortDirection } from "@/lib/types";
import gmData from "@/assets/data/execs.json";

const props = defineProps<{
  teamGM: any;
  selectedDrawerSide: any;
  showGMDrawer: boolean;
}>();
const emit = defineEmits(["update:teamGM", "update:showGMDrawer"]);

const typedGMData = gmData as GM[];

/* Note: Good pattern for creating a two-way bound value in child component */
const localTeamGM = computed({
  get() {
    return props.teamGM;
  },
  set(value) {
    emit("update:teamGM", value);
  },
});

const localShowGMDrawer = computed({
  get() {
    return props.showGMDrawer;
  },
  set(value) {
    emit("update:showGMDrawer", value);
  },
});

const search = ref<string>("");
const searchLoading = ref<boolean>(false);
/* Typing guide: https://vuejs.org/guide/typescript/composition-api.html */
const cardsFlipped = ref<Map<any, boolean>>(new Map());

const sortOptions = ["Alphabetic"];
/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const GM_FILTERS = ["Western Conference", "Eastern Conference"];
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

const sortedGMData = computed(() => {
  const copyGMData = [...typedGMData];

  const sortModifier = sortDirection.value === "asc" ? 1 : -1;

  switch (selectedSort.value) {
    case "Alphabetic":
      return copyGMData.sort((a: any, b: any) => {
        return sortModifier * a.name.localeCompare(b.name);
      });
    default:
      return typedGMData;
  }
});

const filteredGMData = computed(() => {
  const copyGMData = [...sortedGMData.value];

  /* If no filters, return regular sorted data */
  if (selectedFilters.value.length === 0) {
    return copyGMData;
  }
  return [];
});

const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
};

/* GM Select Logic */
const setGM = (gm: any) => {
  localTeamGM.value = gm;
};

const deleteGM = () => {
  localTeamGM.value = null;
};

const selectRandomGM = () => {
  const copyGMData = filteredGMData.value;
  const randomIndex = Math.floor(Math.random() * copyGMData.length);
  localTeamGM.value = copyGMData[randomIndex];
};
</script>

<template>
  <div>
    <h6 class="section-header">General Manager</h6>
    <q-card dark class="gm-card" bordered>
      <q-card-section>
        <h6>General Manager</h6>
      </q-card-section>
      <q-separator />
      <q-card-section class="main-card-section">
        <q-btn
          v-if="!teamGM"
          round
          icon="add_circle"
          size="1.75rem"
          @click="localShowGMDrawer = true"
        />
        <template v-else>
          <q-icon class="blank-avatar" name="account_circle" size="3.5rem" />
          <div>{{ teamGM.name }}</div>
        </template>
      </q-card-section>
      <q-separator dark />
      <q-card-actions>
        <q-btn @click="deleteGM" flat round icon="delete" color="negative" />
      </q-card-actions>
    </q-card>
    <q-drawer
      v-model="localShowGMDrawer"
      :side="localDrawerSide"
      :width="300"
      bordered
      elevated
      overlay
      dark
    >
      <div class="drawer-header">
        <div class="drawer-title-container">
          <h6 class="drawer-title">Add GM</h6>
          <q-btn
            @click="localShowGMDrawer = false"
            round
            icon="close"
            class="drawer-close"
          />
        </div>
        <q-input
          outlined
          v-model="search"
          placeholder="Search for a GM"
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
          <div class="gm-filter-container">
            <q-btn color="primary" label="Filters Menu">
              <q-menu dark>
                <q-list style="min-width: 100px">
                  <template v-for="(filter, index) in GM_FILTERS" :key="index">
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
              title="Select random GM"
              @click="selectRandomGM"
            />
          </div>
        </div>
      </div>
      <q-separator dark />
      <q-scroll-area class="fit">
        <q-virtual-scroll
          style="max-height: 600px"
          :items="filteredGMData"
          v-slot="{ item: gm, index }"
          separator
        >
          <q-item :key="index" @click="() => setGM(gm)" clickable v-ripple>
            <q-item-section class="gm-item">
              <div>
                <div class="name">{{ gm.name }}</div>
              </div>
              <div></div>
            </q-item-section>
          </q-item>
        </q-virtual-scroll>
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

.gm-filter-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.gm-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.gm-item .right {
  justify-content: right;
}

.gm-name {
  font-weight: 600;
}
</style>
