<script setup lang="ts">
import { ref } from 'vue'

import TeamBuilderButtons from "@/components/TeamBuilder/TeamBuilderButtons.vue";

const showDrawer = ref(false);
const search = ref("")

const addPlayer = () => {
  showDrawer.value = !showDrawer.value;
}

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
    <q-drawer v-model="showDrawer" :width="300" bordered elevated overlay dark side="right">
      <div class="drawer-header">
        <h6 class="drawer-title">Add Player</h6>
        <q-btn @click="showDrawer = false" round icon="close" class="drawer-close" />
      </div>
      <q-input outlined v-model="search" placeholder="Search for a player" type="search" dark>
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>
      <!-- <q-scroll-area class="fit">

        <q-list>
          <template v-for="(menuItem, index) in menuList" :key="index">
            <q-item clickable :active="menuItem.label === 'Outbox'" v-ripple>
              <q-item-section avatar>
                <q-icon :name="menuItem.icon" />
              </q-item-section>
              <q-item-section>
                {{ menuItem.label }}
              </q-item-section>
            </q-item>
            <q-separator :key="'sep' + index" v-if="menuItem.separator" />
          </template>
        </q-list>
      </q-scroll-area> -->
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
</style>
