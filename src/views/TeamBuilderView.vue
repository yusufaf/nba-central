<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import TeamBuilderButtons from "@/components/TeamBuilder/TeamBuilderButtons.vue";
import { BDL_API_PREFIX } from "@/constants/constants";

const showDrawer = ref(false);
const search = ref("");
const searchList = ref([] as any[]);
const searchLoading = ref(false);

const addPlayer = () => {
  showDrawer.value = !showDrawer.value;
}

const searchListResults = computed(() => searchList.value.map((player: any) => {
  const { first_name, last_name, height_feet, height_inches, weight_pounds } = player;
  const fullName = `${first_name} ${last_name}`;
  const heightString = height_feet && height_inches ?`${height_feet}' ${height_inches}"` : "N/A Height";
  const weightString = weight_pounds ? `${weight_pounds}lbs` : "N/A Weight";
  const heightAndWeight = `${heightString}, ${weightString}`;
  return {
    ...player,
    fullName,
    heightAndWeight
  }
}));

watch(search, async () => {
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
})


const testFetchData = () => {
  fetch("https://www.balldontlie.io/api/v1/players?per_page=50", {
    method: 'GET',
    headers: {}
  })
    .then(response => {
      response.json().then(res => {
        console.log("Response JSON = ", res);
      });
    })
    .catch(err => {
      console.error(err);
    });
}
</script>

<template>
  <main class="builder-page">
    <h1 class="title">Team Builder</h1>
    <div class="builder-container">
      <!-- Create new TeamBuilderHeaderComponent -->
      <div class="header">
        <!-- <q-input class="title-input" v-model="text" label="Title" stack-label dark /> -->
        <div class="hidden">Hidden</div>
        <!-- TODO: Make the score animated so that when its value changes there's some cool animation  -->
        <div class="score">Score: N/A</div>
        <TeamBuilderButtons />
      </div>
      <div class="builder-main">
        <h6 class="section-header">Starters</h6>
        <div class="main-lineup">
          <q-card dark class="player-card" bordered :key="n" v-for="n in 5">
            <q-card-section>
              <h6>Player {{ n }}</h6>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <!-- Player Img and other player info will replace the + button -->
              <!-- <q-img class="rounded-borders" src="https://cdn.quasar.dev/img/parallax2.jpg" /> -->
              <q-btn @click="addPlayer" flat round icon="add_circle" size="1.75rem" class="add-player-btn"
                title="Add Player" />

            </q-card-section>

            <q-card-actions>
              <q-btn @click="testFetchData" flat round icon="delete" color="negative" />
            </q-card-actions>
          </q-card>
        </div>
        <h6 class="section-header">Bench</h6>
        <div class="bench-lineup">
          <q-card dark class="player-card" bordered :key="n" v-for="n in 10">
            <q-card-section>
              <h6>Player {{ n }}</h6>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <!-- Player Img and other player info will replace the + button -->
              <!-- <q-img class="rounded-borders" src="https://cdn.quasar.dev/img/parallax2.jpg" /> -->
              <q-btn @click="addPlayer" round icon="add_circle" size="1.75rem" class="add-player-btn" />
              <!-- <q-btn flat label="Confirm" color="primary" v-close-popup /> -->

            </q-card-section>

            <q-card-actions>
              <q-btn flat round icon="delete" color="negative" />
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </div>
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
      <q-linear-progress v-if="searchLoading" indeterminate color="primary"/>
      <!-- <q-circular-progress v-if="searchLoading" indeterminate rounded size="50px" color="primary" /> -->
      <q-list>
        <template v-for="(player, index) in searchListResults" :key="player.id">
          <q-item clickable v-ripple>
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
  box-shadow: 0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12);
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

.main-lineup {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.player-card {
  width: 40rem;
  max-width: 40rem;
  height: 15rem;
}

.section-header {
  margin: 1rem 0;
}

.add-player-btn {
  left: 50%;
  transform: translate(-50%, 0%);
}

.bench-lineup {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  /* flex-grow: 0; */
}

::-webkit-scrollbar {
  display: none;
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
