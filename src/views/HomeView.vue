<script setup lang="ts">
import TypeWriter from "@/components/TypeWriter.vue";
import {TYPE_WRITER_PROPS} from "@/constants/constants"
import { ref } from "vue";

</script>

<template>
  <main class="home-page">
    <q-parallax src="@/assets/github.png">
      <TypeWriter
        :textDisplayArray="TYPE_WRITER_PROPS.textDisplayArray"
        :leadInText="TYPE_WRITER_PROPS.leadInText"
        :closingText="TYPE_WRITER_PROPS.closingText"
      />
      <q-icon color="white" name="keyboard_double_arrow_down" />
      <q-btn class="q-mt-md" color="primary" to="teambuilder"
        >Get Started Now</q-btn
      >
    </q-parallax>
  </main>
</template>

<style scoped>
.home-page {
  height: calc(100vh - 7rem);
}
</style>
