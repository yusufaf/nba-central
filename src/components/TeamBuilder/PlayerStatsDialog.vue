<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { NBA2KRating } from "@/models/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp } from "lucide-vue-next";
import { STAT_COLUMNS } from "@/constants/playerStats";

const props = withDefaults(
  defineProps<{
    data: any;
    visible: boolean;
    ratingHistory?: NBA2KRating[];
    playerName?: string;
  }>(),
  {
    ratingHistory: () => [],
    playerName: '',
  },
);

// Oldest release on the left, so the line reads left-to-right as a career.
const ratingTimeline = computed(() =>
  [...(props.ratingHistory ?? [])].reverse(),
);

const RATING_FLOOR = 60;

// Plot the overalls against a fixed 60-99 window rather than the player's own
// min/max, so a steady career reads flat instead of dramatic.
const ratingPoints = computed(() => {
  const timeline = ratingTimeline.value;
  if (timeline.length < 2) return '';

  return timeline
    .map((entry, index) => {
      const x = (index / (timeline.length - 1)) * 100;
      const clamped = Math.max(entry.overall, RATING_FLOOR);
      const y = 100 - ((clamped - RATING_FLOOR) / (99 - RATING_FLOOR)) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
});

const ratingRange = computed(() => {
  const overalls = ratingTimeline.value.map((entry) => entry.overall);
  if (!overalls.length) return null;
  return { min: Math.min(...overalls), max: Math.max(...overalls) };
});

const localVisible = ref(props.visible);
const localData = ref(props.data);

const emit = defineEmits(['update:visible']);

watch(localVisible, (newVisible) => {
  emit("update:visible", newVisible);
});

watch(() => props.visible, (value) => {
  localVisible.value = value;
});

watch(() => props.data, (value) => {
  localData.value = value;
});

const onClose = () => {
  localVisible.value = false;
};

/* Sorting */

// null = the order the API returned, which is already newest season first.
const sortField = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc'>('desc');

/**
 * Cycles descending -> ascending -> unsorted. Descending comes first because
 * every column here is a stat, and the first question about a stat is who or
 * when it peaked, not who was worst.
 */
const toggleSort = (field: string) => {
  if (sortField.value !== field) {
    sortField.value = field;
    sortDirection.value = 'desc';
  } else if (sortDirection.value === 'desc') {
    sortDirection.value = 'asc';
  } else {
    sortField.value = null;
  }
};

const ariaSort = (field: string) => {
  if (sortField.value !== field) return 'none';
  return sortDirection.value === 'asc' ? 'ascending' : 'descending';
};

// Every column is numeric, including season. Rows missing a value sink to the
// bottom either way rather than sorting as zero.
const sortedRows = computed(() => {
  // `data` is untyped and has been handed a single season object before now -
  // render nothing rather than throwing on a non-array.
  const rows = Array.isArray(localData.value) ? [...localData.value] : [];
  const field = sortField.value;
  if (!field) return rows;

  const modifier = sortDirection.value === 'asc' ? 1 : -1;
  return rows.sort((a: any, b: any) => {
    const left = Number(a?.[field]);
    const right = Number(b?.[field]);
    const leftOk = Number.isFinite(left);
    const rightOk = Number.isFinite(right);
    if (!leftOk && !rightOk) return 0;
    if (!leftOk) return 1;
    if (!rightOk) return -1;
    return modifier * (left - right);
  });
});

// A new player's stats shouldn't inherit the previous player's sort.
watch(() => props.data, () => {
  sortField.value = null;
  sortDirection.value = 'desc';
});

const columns = STAT_COLUMNS;
</script>

<template>
  <Dialog v-model:open="localVisible">
    <!-- wide-dialog opts out of the global 45rem cap in main.css, which is
         !important and beats any max-w-* utility. -->
    <DialogContent class="wide-dialog w-[95vw] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ playerName ? `${playerName} — Stats` : 'Player Stats' }}</DialogTitle>
      </DialogHeader>

      <!-- NBA 2K rating history. Only current-roster players have one; retired
           players are rated as their All-Time selves, with no year-by-year run. -->
      <section v-if="ratingTimeline.length > 1" class="rating-history">
        <header class="rating-history-header">
          <h4 class="rating-history-title">NBA 2K Rating History</h4>
          <span v-if="ratingRange" class="rating-history-range">
            {{ ratingRange.min }}–{{ ratingRange.max }} OVR
          </span>
        </header>

        <svg
          class="rating-chart"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          :aria-label="`Overall rating from ${ratingTimeline[0].gameVersion} to ${ratingTimeline[ratingTimeline.length - 1].gameVersion}`"
        >
          <polyline :points="ratingPoints" class="rating-chart-line" />
        </svg>

        <ol class="rating-history-list">
          <li
            v-for="entry in ratingTimeline"
            :key="entry.gameVersion"
            class="rating-history-item"
          >
            <span class="rating-history-value">{{ entry.overall }}</span>
            <span class="rating-history-version">{{ entry.gameVersion }}</span>
          </li>
        </ol>
      </section>

      <!-- min-w-0: DialogContent is a grid, and a grid item's default
           min-width:auto lets the wide table stretch this container instead of
           scrolling inside it, which pushes the overflow onto the dialog. -->
      <div class="w-full min-w-0 overflow-x-auto">
        <TooltipProvider :delay-duration="200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  v-for="column in columns"
                  :key="column.name"
                  class="text-white whitespace-nowrap"
                  :aria-sort="ariaSort(column.field)"
                >
                  <Tooltip>
                    <TooltipTrigger
                      as="button"
                      type="button"
                      data-inline-control
                      class="stat-header"
                      :class="{ 'stat-header-active': sortField === column.field }"
                      @click="toggleSort(column.field)"
                    >
                      {{ column.label }}
                      <ArrowDown
                        v-if="sortField === column.field && sortDirection === 'desc'"
                        class="stat-sort-icon"
                      />
                      <ArrowUp
                        v-else-if="sortField === column.field"
                        class="stat-sort-icon"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ column.title }}
                      <span class="stat-sort-hint">Click to sort</span>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(row, index) in sortedRows"
                :key="row.id ?? index"
                class="border-gray-700"
              >
                <TableCell
                  v-for="column in columns"
                  :key="column.name"
                  class="text-gray-300 whitespace-nowrap"
                >
                  {{ row[column.field] }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="onClose">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* Dotted underline is the convention for "this abbreviation has a definition";
   the arrow carries the sortable affordance. */
.stat-header {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: underline dotted hsl(var(--muted-foreground) / 0.6);
  text-underline-offset: 0.25rem;
  transition: color 0.15s ease;
}

.stat-header:hover,
.stat-header:focus-visible {
  color: hsl(var(--primary));
}

.stat-header:focus-visible {
  outline: 0.125rem solid hsl(var(--primary));
  outline-offset: 0.125rem;
  border-radius: 0.125rem;
}

.stat-header-active {
  color: hsl(var(--primary));
}

.stat-sort-icon {
  width: 0.75rem;
  height: 0.75rem;
  flex-shrink: 0;
}

.stat-sort-hint {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  opacity: 0.7;
}

.rating-history {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  /* Same grid-item shrink fix as the stats table below it - without this the
     18-release timeline stretches the dialog and gets clipped. */
  min-width: 0;
  padding: 1rem;
  border: 0.0625rem solid hsl(var(--border));
  border-radius: 0.5rem;
  background-color: hsl(var(--muted) / 0.2);
}

.rating-history-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.rating-history-title {
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
  color: hsl(var(--foreground));
}

.rating-history-range {
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.rating-chart {
  width: 100%;
  height: 4rem;
  overflow: visible;
}

.rating-chart-line {
  fill: none;
  stroke: hsl(var(--primary));
  stroke-width: 2;
  /* Keep an even stroke despite the non-uniform viewBox scaling. */
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.rating-history-list {
  display: flex;
  justify-content: space-between;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
}

.rating-history-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 2.25rem;
}

.rating-history-value {
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--primary));
}

.rating-history-version {
  font-size: 0.625rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
</style>
