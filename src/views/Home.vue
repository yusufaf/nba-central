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
      <!-- Video Background. Served from /public rather than imported so the
           clip stays out of the Vite graph. The poster paints immediately and
           covers the gap before the loop starts, or stands in entirely where
           autoplay is refused. playsinline is required for iOS to autoplay. -->
      <video
        class="video"
        poster="/hero/hero-poster.jpg"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/hero/hero-loop.mp4" type="video/mp4" />
      </video>

      <!-- Scrim: the hero copy is white over live footage, which has no
           contrast guarantee on its own. -->
      <div class="scrim"></div>

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

.scrim {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    to bottom,
    hsl(var(--background) / 0.45) 0%,
    hsl(var(--background) / 0.65) 100%
  );
}

@media (prefers-reduced-motion: reduce) {
  .video {
    display: none;
  }

  .scrim {
    background-image: url('/hero/hero-poster.jpg');
    background-size: cover;
    background-position: center;
  }
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
