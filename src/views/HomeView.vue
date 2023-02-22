<script setup lang="ts">
import { ref } from 'vue'
const slide = ref<string>('style');
const lorem = ref<string>('Lorem ipsum dolor, sit amet consectetur adipisicing elit. Itaque voluptatem totam, architecto cupiditate officia rerum, error dignissimos praesentium libero ab nemo.')

</script>

<template>
  <main class="home-page">
    <q-carousel v-model="slide" animated transition-prev="jump-right" transition-next="jump-left" swipeable
      control-color="white" prev-icon="arrow_left" next-icon="arrow_right" navigation padding arrows height="100%"
      class="bg-black text-white shadow-1 rounded-borders">
      <q-carousel-slide name="style" class="column no-wrap flex-center">
        <!-- <q-icon name="style" size="56px" /> -->

        <!-- <div class="q-mt-md text-center">
            {{ lorem }}
          </div> -->
      </q-carousel-slide>
      <q-carousel-slide name="tv" class="column no-wrap flex-center">
        <q-icon name="live_tv" size="56px" />
        <div class="q-mt-md text-center">
          {{ lorem }}
        </div>
      </q-carousel-slide>
      <q-carousel-slide name="layers" class="column no-wrap flex-center">
        <q-icon name="layers" size="56px" />
        <div class="q-mt-md text-center">
          {{ lorem }}
        </div>
      </q-carousel-slide>
      <q-carousel-slide name="map" class="column no-wrap flex-center">
        <q-icon name="terrain" size="56px" />
        <div class="q-mt-md text-center">
          {{ lorem }}
        </div>
      </q-carousel-slide>
    </q-carousel>
  </main>
</template>

<style scoped>
.home-page {
  height: calc(100vh - 7rem);
}
</style>