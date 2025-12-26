<script setup lang="ts">
import { computed } from 'vue';
import PlayerSlot from './PlayerSlot.vue';

interface Player {
  id: number;
  fullName: string;
  first_name: string;
  last_name: string;
  position: string;
  team: {
    full_name: string;
    abbreviation: string;
  };
  playerStats?: any[];
}

interface Props {
  selectedPlayers: Map<number, Player>;
  cardsFlipped: Map<number, boolean>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'addPlayer': [index: number];
  'removePlayer': [index: number];
  'flipCard': [index: number];
  'viewStats': [index: number];
  'compare': [index: number];
}>();

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const STARTER_INDICES = [1, 2, 3, 4, 5];
const BENCH_INDICES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const starterCount = computed(() => {
  return STARTER_INDICES.filter(i => props.selectedPlayers.has(i)).length;
});
</script>

<template>
  <div class="roster-section">
    <!-- Starting Lineup Section -->
    <div class="lineup-section">
      <div class="section-header">
        <h3 class="section-subtitle">Starting Lineup</h3>
        <div class="starter-count">{{ starterCount }}/5</div>
      </div>
      <div class="starters-grid">
        <PlayerSlot
          v-for="(index, posIndex) in STARTER_INDICES"
          :key="index"
          :slot-index="index"
          :position="POSITIONS[posIndex]"
          :player="selectedPlayers.get(index)"
          :is-flipped="cardsFlipped.get(index)"
          @add="emit('addPlayer', $event)"
          @remove="emit('removePlayer', $event)"
          @flip="emit('flipCard', $event)"
          @view-stats="emit('viewStats', $event)"
          @compare="emit('compare', $event)"
        />
      </div>
    </div>

    <!-- Bench Section -->
    <div class="lineup-section">
      <div class="section-header">
        <h3 class="section-subtitle">Bench</h3>
      </div>
      <div class="bench-grid">
        <PlayerSlot
          v-for="index in BENCH_INDICES"
          :key="index"
          :slot-index="index"
          :player="selectedPlayers.get(index)"
          :is-flipped="cardsFlipped.get(index)"
          @add="emit('addPlayer', $event)"
          @remove="emit('removePlayer', $event)"
          @flip="emit('flipCard', $event)"
          @view-stats="emit('viewStats', $event)"
          @compare="emit('compare', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.roster-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.lineup-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid hsl(var(--border));
}

.section-subtitle {
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  letter-spacing: -0.025em;
  margin: 0;
}

.starter-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 0.3);
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
}

.starters-grid,
.bench-grid {
  display: grid;
  gap: 1rem;
}

.starters-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.bench-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

/* Desktop - 5 columns for starters */
@media (min-width: 1280px) {
  .starters-grid {
    grid-template-columns: repeat(5, 1fr);
  }

  .bench-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

/* Large tablets - 4 columns */
@media (min-width: 1024px) and (max-width: 1279px) {
  .starters-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .bench-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Tablets - 3 columns */
@media (min-width: 768px) and (max-width: 1023px) {
  .starters-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .bench-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Small tablets - 2 columns */
@media (min-width: 640px) and (max-width: 767px) {
  .starters-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .bench-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile - 1 column */
@media (max-width: 639px) {
  .starters-grid {
    grid-template-columns: 1fr;
  }

  .bench-grid {
    grid-template-columns: 1fr;
  }

  .roster-section {
    gap: 2rem;
  }
}
</style>
