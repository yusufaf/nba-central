<script setup lang="ts">
import TeamBuilderButtons from "@/components/TeamBuilder/TeamBuilderButtons.vue";
</script>

<template>
  <main class="builder-page">
    <h1 class="title">Hey</h1>
    <div class="builder-container">
        <TeamBuilderButtons/>
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
  width: calc(100% - 30rem);
  height: 35rem;
  border-radius: 0.25rem;
}
</style>
