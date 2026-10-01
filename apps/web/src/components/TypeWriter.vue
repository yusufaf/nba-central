<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { useReducedMotion } from "@/composables/useDisplayPreferences";

const props = defineProps<{
  leadInText: string;
  textDisplayArray: string[];
  closingText: string;
}>();

const typeValue = ref<string>("");
const typeStatus = ref<boolean>(false);
const displayTextArray = ref<string[]>(props.textDisplayArray);
const typingSpeed = ref<number>(100);
const erasingSpeed = ref<number>(100);
const newTextDelay = ref<number>(1500);
const displayTextArrayIndex = ref<number>(0);
const charIndex = ref<number>(0);
const reduceMotion = useReducedMotion();

let timer: ReturnType<typeof setTimeout> | undefined;
const schedule = (step: () => void, delay: number) => {
  timer = setTimeout(step, delay);
};

const typeText = () => {
  if (
    charIndex.value < displayTextArray.value[displayTextArrayIndex.value].length
  ) {
    if (!typeStatus.value) typeStatus.value = true;
    typeValue.value += displayTextArray.value[
      displayTextArrayIndex.value
    ].charAt(charIndex.value);
    charIndex.value += 1;
    schedule(typeText, typingSpeed.value);
  } else {
    typeStatus.value = false;
    schedule(eraseText, newTextDelay.value);
  }
}

// With motion reduced the headline holds still on its first word, and
// starts typing again from the top if motion is turned back on.
watch(
  reduceMotion,
  (reduce) => {
    clearTimeout(timer);
    displayTextArrayIndex.value = 0;
    typeStatus.value = false;
    if (reduce) {
      typeValue.value = displayTextArray.value[0];
      charIndex.value = typeValue.value.length;
    } else {
      typeValue.value = "";
      charIndex.value = 0;
      schedule(typeText, newTextDelay.value + 200);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => clearTimeout(timer));

const eraseText = () => {
  if (charIndex.value > 0) {
    if (!typeStatus.value) typeStatus.value = true;
    typeValue.value = displayTextArray.value[
      displayTextArrayIndex.value
    ].substring(0, charIndex.value - 1);
    charIndex.value -= 1;
    schedule(eraseText, erasingSpeed.value);
  } else {
    typeStatus.value = false;
    displayTextArrayIndex.value += 1;
    if (displayTextArrayIndex.value >= displayTextArray.value.length)
      displayTextArrayIndex.value = 0;
    schedule(typeText, typingSpeed.value + 1000);
  }
}
</script>

<template>
  <div class="container">
    <h1>
      {{props.leadInText}}
      <span class="typed-text">{{ typeValue }}</span>
      <span v-if="!reduceMotion" class="blinking-cursor">|</span>
      <!-- <span class="cursor" :class="{ typing: typeStatus }">&nbsp;</span> -->
      <span class="close-text">{{props.closingText}}</span>
    </h1>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
}

h1 {
  font-size: 6rem;
  font-weight: normal;
  color: hsl(var(--foreground));
}

span.typed-text {
  color: hsl(var(--primary));
}

.blinking-cursor {
  font-size: 6rem;
  color: hsl(var(--primary));
  /* color: #2c3e50; */
  -webkit-animation: 1s blink step-end infinite;
  -moz-animation: 1s blink step-end infinite;
  -ms-animation: 1s blink step-end infinite;
  -o-animation: 1s blink step-end infinite;
  animation: 1s blink step-end infinite;
}

@keyframes blink {
  from,
  to {
    color: transparent;
  }

  50% {
    color: hsl(var(--primary));
  }
}

@-moz-keyframes blink {
  from,
  to {
    color: transparent;
  }

  50% {
    color: hsl(var(--primary));
  }
}

@-webkit-keyframes blink {
  from,
  to {
    color: transparent;
  }

  50% {
    color: hsl(var(--primary));
  }
}

@-ms-keyframes blink {
  from,
  to {
    color: transparent;
  }

  50% {
    color: hsl(var(--primary));
  }
}

@-o-keyframes blink {
  from,
  to {
    color: transparent;
  }

  50% {
    color: hsl(var(--primary));
  }
}

.typing {
  border-right: 0.2rem solid hsl(var(--primary));
}

.close-text {
  /* margin-left: -0.25rem; */
}

</style>
