<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import TeamBuilderButtons from "@/components/TeamBuilder/TeamBuilderButtons.vue";
// import TeamBuilderDrawer from '@/components/TeamBuilder/TeamBuilderDrawer.vue';
import { BDL_API_PREFIX, VIEWS } from "@/constants/constants";
import { range } from "@/constants/functions";
import { debounce, useQuasar } from "quasar"
// TODO: Can use this for new IDs when storing
import { uid } from 'quasar'
import draggable from 'vuedraggable'


const $q = useQuasar();

/* Team Metadata */
const teamName = ref<string>("");

const showDrawer = ref<boolean>(false);
const search = ref<string>("");
const searchList = ref<any[]>([]);
const searchLoading = ref<boolean>(false);
/* Typing guide: https://vuejs.org/guide/typescript/composition-api.html */
const selectedPlayerIndex = ref<number | null>(null);
const selectedPlayersData = ref(new Map());

/* Sorting and Filtering */
const showSortDropdown = ref<boolean>(false);
const selectedSort = ref<string | null>(null);
const sortOptions = ['Alphabetic (A-Z)', 'Reverse Alphabetic (Z-A)'];
const selectedView = ref<string>("Default");

const selectedFilters = ref<string[]>([]);
const AVAILABLE_FILTERS = ["Current Season Only", "PG", "SG", "SF", "PF", "C"];

/* Note to self: Use watchers to get reactive console logs */
watch(selectedFilters, (selectedFilters, prevFilters) => {
    console.log(selectedFilters, prevFilters);
})

const addPlayer = (index: number) => {
  selectedPlayerIndex.value = index;
  /* If already visible, don't do anything */
  if (showDrawer.value) {
    return;
  }
  showDrawer.value = !showDrawer.value;
}

const deletePlayer = (index: number) => {
  selectedPlayersData.value.delete(index);
}

const searchListResults = computed(() => searchList.value.map((player: any) => {
  const { first_name, last_name, height_feet, height_inches, weight_pounds } = player;
  const fullName = `${first_name} ${last_name}`;
  const heightString = height_feet && height_inches ? `${height_feet}' ${height_inches}"` : "N/A Height";
  const weightString = weight_pounds ? `${weight_pounds}lbs` : "N/A Weight";
  const heightAndWeight = `${heightString}, ${weightString}`;
  return {
    ...player,
    fullName,
    heightAndWeight
  }
}));

/* TODO: See if putting this into separate function still works */
watch(search, debounce(async () => {
  const searchedPlayer = search.value;

  /* If not an empty string, make API call */
  if (searchedPlayer) {
    /* TODO: Disable the search input while search is loading? */
    searchLoading.value = true;
    /* TODO: Review this, clearing the list before every API call*/
    searchList.value = [];
    try {
      let next_page = null;
      do {
        const page: number | null = next_page ? next_page : "";
        const response: any = await fetch(`${BDL_API_PREFIX}/players?per_page=50&search=${searchedPlayer}&page=${page}`)
        const responseJSON = await response.json();
        const { data, meta } = responseJSON;
        next_page = meta.next_page;
        searchList.value = [...searchList.value, ...data];
      } while (next_page != null);

    }
    catch (error) {
      console.error("Error! Failed to make search API call");
      /* */
    }
    finally {
      searchLoading.value = false;
    }
  }
  else {
    /* Clear the search list if no longer any players being searched for */
    searchList.value = [];
  }
}, 600));


const addPlayerFromList = (player: any) => {
  const playerIndex = selectedPlayerIndex.value;
  console.log({ playerIndex });
  const currentPlayer = selectedPlayersData.value.get(playerIndex);

  /* Set the player at that index in the map */
  selectedPlayersData.value.set(playerIndex, player);
  console.log("Selected Players Data = ", selectedPlayersData.value);
}

const resetTeam = () => {

}
const saveTeam = () => {


  // TODO: determine if saving was successful or not
  $q.notify({
    message: 'Successfully saved team!',
    type: "positive",
    position: "bottom-left",
    closeBtn: true
  })
}

/*  Note on draggable cards:
https://stackoverflow.com/questions/73325793/horizontally-draggable-quasar-q-cards-using-vue-draggable-next 
*/
const drag = ref<boolean>(false);
const items = ref([
  { id: "1", name: 'item1' },
  { id: "2", name: 'item2' },
  { id: "3", name: 'item3' },
  { id: "4", name: 'item4' },
  { id: "5", name: 'item5' },
]);
const testArray = ref([]);

</script>

<template>
  <main class="builder-page">
    <h1 class="title">Team Builder</h1>
    <div class="builder-container shadow-8">
      <!-- Create new TeamBuilderHeaderComponent -->
      <div class="header">
        <q-input class="title-input" v-model="teamName" label="Team Name" stack-label dark />
        <div class="hidden">Hidden</div>

        <!-- TODO: Make the score animated so that when its value changes there's some cool animation  -->
        <div class="score">Score: N/A</div>
        <TeamBuilderButtons @saveTeam="saveTeam" @reset="resetTeam" @viewChange="(newView) => selectedView = newView" />
      </div>
      <div class="builder-main">
        <h6 class="section-header">Starters</h6>
        <div class="main-lineup" :class="{ list: selectedView === VIEWS.LIST }">

          <!-- TODO: Move cards into separate PlayerCard components -->
          <q-card dark class="player-card" bordered :key="n" v-for="n in 5">
            <q-card-section>
              <h6>Player {{ n }}</h6>
            </q-card-section>
            <q-separator dark />
            <q-card-section class="main-card-section">
              <!-- Player Img and other player info will replace the + button -->
              <!-- <q-img class="rounded-borders" src="https://cdn.quasar.dev/img/parallax2.jpg" /> -->
              <!-- {{ selectedPlayersData.has(n) }} -->
              <!-- If there's no player with data @ this index, render the add player button -->
              <q-btn v-if="!selectedPlayersData.has(n)" @click="addPlayer(n)" flat round icon="add_circle" size="1.75rem"
                class="add-player-btn" title="Add Player" />
              <template v-else>
                <q-icon class="blank-avatar" name="account_circle" size="3.5rem" />
                <div>{{ selectedPlayersData.get(n).fullName }}</div>
              </template>
            </q-card-section>
            <q-separator dark />
            <q-card-actions>
              <q-btn @click="deletePlayer(n)" flat round icon="delete" color="negative" title="Delete player from team"/>
            </q-card-actions>
          </q-card>
        </div>
        <h6 class="section-header">Bench</h6>
        <div class="bench-lineup" :class="{ list: selectedView === VIEWS.LIST }">
          <q-card dark class="player-card" bordered :key="n" v-for="n in range(6, 15)">
            <q-card-section>
              <h6>Player {{ n }}</h6>
            </q-card-section>
            <q-separator />
            <q-card-section class="main-card-section">
              <!-- Player Img and other player info will replace the + button -->
              <q-btn v-if="!selectedPlayersData.has(n)" @click="addPlayer(n)" round icon="add_circle" size="1.75rem"
                class="add-player-btn" />
              <template v-else>
                <q-icon class="blank-avatar" name="account_circle" size="3.5rem" />
                <div>{{ selectedPlayersData.get(n).fullName }}</div>
              </template>
            </q-card-section>
            <q-separator dark />
            <q-card-actions>
              <q-btn @click="deletePlayer(n)" flat round icon="delete" color="negative" />
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </div>
    <!-- <TeamBuilderDrawer 
          v-bind:showDrawer="showDrawer"
        /> -->
    <q-drawer class="drawer" v-model="showDrawer" :width="300" bordered elevated overlay dark side="right">
      <div class="drawer-header">
        <h6 class="drawer-title">Add Player</h6>
        <q-btn @click="showDrawer = false" round icon="close" class="drawer-close" />
      </div>
      <q-input outlined v-model="search" placeholder="Search for a player" type="search" dark>
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>
      <q-linear-progress v-if="searchLoading" indeterminate color="primary" />

      <!-- TODO: Figure out how you want the sort and filters to show up
          - Hidden in a menu that opens up on click of a button?
          - Visible dropdowns
          -->
      <div>
        <q-select outlined v-model="selectedSort" :options="sortOptions" label="Sort" clearable dark />
        <q-btn color="primary" label="Filters Menu">
          <q-menu dark>
            <q-list style="min-width: 100px">
              <template v-for="(filter, index) in AVAILABLE_FILTERS" :key="index">
                <q-item tag="label" avatar>
                  <q-item-section>
                    <q-checkbox v-model="selectedFilters" :val="filter" dark />
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
      <q-separator dark />
      <q-list>
        <template v-for="(player) in searchListResults" :key="player.id">
          <q-item @click="addPlayerFromList(player)" clickable v-ripple>
            <q-item-section class="player-item">
              <div>
                <div>{{ player.fullName }}</div>
                <div>{{ player.heightAndWeight }}</div>
                <div>{{ player.team.full_name }}</div>
              </div>
              <div class="player-position">
                {{ player.position }}
              </div>
            </q-item-section>
          </q-item>
          <q-separator />
        </template>
      </q-list>
    </q-drawer>
  </main>
</template>

<style scoped>
.builder-page {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 0 4rem;
}

.title {
  font-size: 3rem;
  margin: 2rem 0;
  font-weight: 600;
}

.builder-container {
  background: var(--vt-c-black-soft);
  width: calc(100% - 10rem);
  height: 35rem;
  border-radius: 0.25rem;
}

.header {
  display: flex;
  align-items: center;
  border-bottom: 0.125rem solid var(--vt-c-divider-dark-1);
}

.title-input {
  width: 15%;
  margin-left: 2rem;
}

.hidden {
  visibility: hidden
}

.score {
  display: flex;
  font-size: 2rem;
  font-weight: 600;
  margin-left: auto;
  /* justify-self: center; */
}

.builder-main {
  margin: 1rem 2rem 0 2rem;
  height: 25rem;
  overflow-y: auto;
}

.main-lineup,
.bench-lineup {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2rem;
  grid-auto-flow: row;
}

.main-lineup.list,
.bench-lineup.list {
  grid-template-columns: unset;
}


.player-card {
  display: grid;
  grid-template-rows: 4rem auto 8rem auto 3rem;
}

.section-header {
  margin: 1rem 0;
}

.add-player-btn {}


::-webkit-scrollbar {
  display: none;
}

.blank-avatar {}

.main-card-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Drawer Styles */
.drawer-header {
  display: flex;
  height: fit-content;
}

.drawer-title {
  padding: 0.25rem 0 0 1rem;
}

.drawer-close {
  display: flex;
  margin-left: auto;
}

.player-item {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.player-position {
  margin-left: auto;
}
</style>
