<script setup lang="ts">
import TeamBuilderButtons from "@/components/TeamBuilder/TeamBuilderButtons.vue";
</script>

<template>
  <main class="builder-page">
    <h1 class="title">Team Builder</h1>
    <div class="builder-container">
      <!-- Create new TeamBuilderHeaderComponent -->
      <div class="header">
        <!-- <q-input v-model="text" label="Title" /> -->
        <q-input v-model="text" label="Title" stack-label dark />
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
              <!-- <q-img class="rounded-borders" src="https://cdn.quasar.dev/img/parallax2.jpg" /> -->
              <q-btn flat round icon="add_circle" size="1.75rem" class/>
  
            </q-card-section>
  
            <q-card-actions>
              <q-btn flat round icon="delete" color="negative"/>
            </q-card-actions>
          </q-card>
        </div>
        <h6 class="section-header">Bench</h6>
      </div>
    </div>
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

.score {
  display: flex;
  font-size: 2rem;
  font-weight: 600;
  margin-left: auto;
  justify-self: center;
}

.builder-main {
  margin: 1rem 2rem 0 2rem;
}

.main-lineup {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.player-card {
  width: 40rem;
  height: 15rem;
}

.section-header {
  margin: 1rem 0;
}

</style>
