<script setup lang="ts">
import TypeWriter from "@/components/TypeWriter.vue";
import { TYPE_WRITER_PROPS } from "@/constants/constants";
import { Button } from "@/components/ui/button";
import { ChevronsDown } from "lucide-vue-next";
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <main class="home-page">
    <div class="relative w-full h-full overflow-hidden">
      <!-- Video Background -->
      <video
        src="@/assets/NBA_Highlights_First6min.mp4"
        class="video"
        autoplay
        loop
        muted
      />

      <!-- Content Overlay -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <TypeWriter
          :textDisplayArray="TYPE_WRITER_PROPS.textDisplayArray"
          :leadInText="TYPE_WRITER_PROPS.leadInText"
          :closingText="TYPE_WRITER_PROPS.closingText"
        />
        <ChevronsDown class="text-white w-24 h-24 mt-4" />

        <Button
          class="mt-4 text-xl px-8 py-6"
          @click="router.push('/teambuilder')"
        >
          Get Started Now
        </Button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.home-page {
  height: calc(100vh - 7rem);
}

.video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

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
