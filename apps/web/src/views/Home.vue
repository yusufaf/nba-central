<script setup lang="ts">
import TypeWriter from "@/components/TypeWriter.vue";
import { TYPE_WRITER_PROPS } from "@/constants/constants";
import { Button } from "@/components/ui/button";
import { ChevronsDown } from "lucide-vue-next";
import { useRouter } from "vue-router";
import heroMedia from "@/assets/data/heroMedia.json";

const router = useRouter();

// hero-loop.mp4 used to be Git LFS-tracked and served straight from public/ -
// CI's checkout never fetched LFS objects, so production served the LFS
// pointer text labeled video/mp4, and the browser's decoder failed with no
// visible error. Logging here is the safety net that was missing.
const onVideoError = (event: Event) => {
  if (import.meta.env.DEV) {
    console.error("Hero video failed to load, poster will show instead:", event);
  }
};
</script>

<template>
  <main class="home-page">
    <div class="relative w-full h-full overflow-hidden">
      <!-- Video Background. The clip is served from the assets CDN (see
           apps/cdk/scripts/upload-hero-video.ts) rather than public/, which
           used to Git-LFS-track it - CI's checkout never fetched the LFS
           object, so production silently served a ~130-byte pointer file
           labeled video/mp4. The poster stays local: it's not LFS-tracked,
           it paints immediately and covers the gap before the loop starts
           (or stands in entirely where autoplay is refused or the CDN
           request fails), and the prefers-reduced-motion rule below
           references it directly, which a JSON import can't do.
           playsinline is required for iOS to autoplay. -->
      <video
        class="video"
        poster="/hero/hero-poster.jpg"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
        @error="onVideoError"
      >
        <source :src="heroMedia.heroLoop" type="video/mp4" />
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
  transform: translateX(1.25rem);
  opacity: 0;
}
</style>
