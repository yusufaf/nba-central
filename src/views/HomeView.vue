<script setup lang="ts">
import TypeWriter from "@/components/TypeWriter.vue";
import { TYPE_WRITER_PROPS } from "@/constants/constants";
import { ref, Transition } from "vue";
</script>

<!-- When using the video tag inside QParallax, you must provide the width and height attributes in order for QParallax to work properly -->
<template>
  <main class="home-page">
    <q-parallax>
      <template v-slot:media>
        <video
          src="@/assets/NBA_Highlights_First6min.mp4"
          class="video"
          height="500"
          width="1080"
          autoplay
          loop
          muted
        />
      </template>
      <template v-slot:content="scope">
        <div class="absolute column items-center">
          <TypeWriter
            :textDisplayArray="TYPE_WRITER_PROPS.textDisplayArray"
            :leadInText="TYPE_WRITER_PROPS.leadInText"
            :closingText="TYPE_WRITER_PROPS.closingText"
          />
          <q-icon color="white" name="keyboard_double_arrow_down" size="6rem" />

          <q-btn primary class="q-mt-md" color="primary" to="teambuilder" size="1.25rem">
            Get Started Now
          </q-btn>
        </div>
      </template>
    </q-parallax>
  </main>
</template>

<style scoped>
.home-page {
  height: calc(100vh - 7rem);
}

.video {
  object-fit: cover;
  /* position: fixed;
  right: 0;
  bottom: 0;
  min-width: 100%;
  min-height: 100%; */
}

/*
  Enter and leave animations can use different
  durations and timing functions.
*/
.fade-enter-active {
  transition: all 0.3s ease-out;
}

.fade-leave-active {
  transition: all 0.8s cubic-bezier(1, 0.5, 0.8, 1);
}

.fade-enter-from,
.fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
