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
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Settings, SlidersHorizontal, RotateCcw } from "lucide-vue-next";
import {
  STAT_COLUMNS,
  COUNTING_STATS,
  formatStat,
  formatCellValue,
  careerAverages,
  careerTotals,
  careerBests,
  isCareerBest,
  CAREER_BEST_MIN_GAMES,
  LOWER_IS_BETTER,
  type StatColumn,
} from "@/constants/playerStats";
import { usePlayerStatsPreferences } from "@/composables/usePlayerStatsPreferences";

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

const { preferences, resetPreferences } = usePlayerStatsPreferences();

// Each option shows the same season rendered its own way, so the choice is made
// by reading the samples rather than by decoding the format token.
const seasonFormatOptions = [
  { value: 'YYYY-YY', sample: '2010-11', hint: 'NBA style' },
  { value: 'YYYY-YYYY', sample: '2010-2011', hint: 'Full years' },
  { value: 'YYYY', sample: '2010', hint: 'Start year' },
  { value: 'YYYY+1', sample: '2011', hint: 'End year' },
] as const;

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

const summaryData = computed(() => {
  const rows = Array.isArray(localData.value) ? localData.value : [];
  if (!rows.length) return null;
  if (preferences.value.statMode === 'totals') {
    return careerTotals(rows);
  }
  return careerAverages(rows);
});

// Highs are read off the unsorted rows, and recomputed for totals mode because
// a 60-game season can lead per game while a 82-game one leads on the season.
const bests = computed(() => {
  if (!preferences.value.highlightCareerHighs) return null;
  const rows = Array.isArray(localData.value) ? localData.value : [];
  if (rows.length < 2) return null;
  return careerBests(rows, preferences.value.statMode);
});

const highlightCell = (field: string, row: any) =>
  isCareerBest(field, row, bests.value, preferences.value.statMode);

// Colour alone can't carry the meaning, so the marked cell says what it is.
const highlightTitle = (field: string) =>
  LOWER_IS_BETTER.has(field) ? 'Career low' : 'Career high';

const getColumnTitle = (column: StatColumn) => {
  if (preferences.value.statMode === 'totals' && COUNTING_STATS.includes(column.field)) {
    return column.title.replace(' per Game', ' Total in Season');
  }
  return column.title;
};

// A new player's stats shouldn't inherit the previous player's sort.
watch(() => props.data, () => {
  sortField.value = null;
  sortDirection.value = 'desc';
});

const columns = STAT_COLUMNS;
</script>

<template>
  <Dialog v-model:open="localVisible">
    <!-- size="wide" because this table is 21 columns. -->
    <DialogContent size="wide" class="w-[95vw] max-h-[90vh] overflow-y-auto">
      <!-- pr-14 keeps the title clear of the close button, which DialogContent
           positions absolutely in this same corner. -->
      <DialogHeader class="border-b border-border pb-4 pr-14">
        <DialogTitle class="text-xl">
          {{ playerName ? `${playerName} — Stats` : 'Player Stats' }}
        </DialogTitle>
      </DialogHeader>

      <!-- The preferences trigger gets its own row rather than sharing the
           header: beside the title it collides with the absolutely-positioned
           close button, which sits outside this flow and can't be flexed around. -->
      <div class="flex justify-end -mt-1 -mb-2">
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="prefs-trigger"
              title="Stats display preferences"
            >
              <Settings class="h-3.5 w-3.5 text-primary" />
              <span>Preferences</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            :side-offset="8"
            class="stats-preferences-popover prefs-panel"
          >
            <header class="prefs-head">
              <span class="prefs-head-icon">
                <SlidersHorizontal class="h-4 w-4" />
              </span>
              <div class="prefs-head-text">
                <h4>Stats Display</h4>
                <p>Applies to every player's stats table.</p>
              </div>
            </header>

            <section class="prefs-section">
              <Label class="prefs-label">Season format</Label>
              <ToggleGroup
                v-model="preferences.seasonFormat"
                type="single"
                class="prefs-toggle-grid grid w-full grid-cols-2 gap-[0.3125rem]"
                @update:model-value="(val) => { if (!val) preferences.seasonFormat = 'YYYY-YY'; }"
              >
                <ToggleGroupItem
                  v-for="option in seasonFormatOptions"
                  :key="option.value"
                  :value="option.value"
                  class="prefs-toggle flex h-auto min-h-10 w-full flex-col gap-px px-2 py-1.5"
                >
                  <span class="prefs-toggle-value">{{ option.sample }}</span>
                  <span class="prefs-toggle-hint">{{ option.hint }}</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </section>

            <section class="prefs-section">
              <Label class="prefs-label">Stat values</Label>
              <ToggleGroup
                v-model="preferences.statMode"
                type="single"
                class="prefs-toggle-grid grid w-full grid-cols-2 gap-[0.3125rem]"
                @update:model-value="(val) => { if (!val) preferences.statMode = 'per_game'; }"
              >
                <ToggleGroupItem value="per_game" class="prefs-toggle flex h-auto min-h-10 w-full flex-col gap-px px-2 py-1.5">
                  <span class="prefs-toggle-value">Per game</span>
                  <span class="prefs-toggle-hint">Averages</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="totals" class="prefs-toggle flex h-auto min-h-10 w-full flex-col gap-px px-2 py-1.5">
                  <span class="prefs-toggle-value">Totals</span>
                  <span class="prefs-toggle-hint">Season sums</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </section>

            <label for="show-career-summary" class="prefs-check-row">
              <Checkbox
                id="show-career-summary"
                v-model:checked="preferences.showCareerSummary"
              />
              <span class="prefs-check-text">
                <span class="prefs-check-title">Career summary row</span>
                <p>Totals line pinned to the bottom of the table.</p>
              </span>
            </label>

            <label for="highlight-career-highs" class="prefs-check-row">
              <Checkbox
                id="highlight-career-highs"
                v-model:checked="preferences.highlightCareerHighs"
              />
              <span class="prefs-check-text">
                <span class="prefs-check-title">Highlight career highs</span>
                <p>
                  Best season in each column, in orange. Seasons under
                  {{ CAREER_BEST_MIN_GAMES }} games don't count.
                </p>
              </span>
            </label>

            <footer class="prefs-foot">
              <Button variant="ghost" size="sm" class="prefs-reset" @click="resetPreferences">
                <RotateCcw class="h-3 w-3" />
                Reset defaults
              </Button>
            </footer>
          </PopoverContent>
        </Popover>
      </div>

      <!-- NBA 2K rating history. Only current-roster players have one; retired
           players are rated as their All-Time selves, with no year-by-year run. -->
      <section v-if="ratingTimeline.length > 1" class="rating-history mt-2">
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
                      {{ getColumnTitle(column) }}
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
                  :class="{ 'stat-career-best': highlightCell(column.field, row) }"
                  :title="highlightCell(column.field, row) ? highlightTitle(column.field) : undefined"
                >
                  {{ formatCellValue(column.field, row, preferences.seasonFormat, preferences.statMode) }}
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter v-if="preferences.showCareerSummary && summaryData">
              <TableRow class="bg-zinc-800/80 font-bold border-t-2 border-primary/50">
                <TableCell
                  v-for="column in columns"
                  :key="column.name"
                  class="whitespace-nowrap font-bold text-primary"
                >
                  <template v-if="column.field === 'season'">
                    {{ preferences.statMode === 'totals' ? 'Career Total' : 'Career' }}
                  </template>
                  <template v-else-if="column.field === 'games_played'">
                    {{ summaryData.games_played }}
                  </template>
                  <template v-else-if="preferences.statMode === 'totals' && COUNTING_STATS.includes(column.field)">
                    {{ summaryData[column.field]?.toLocaleString() }}
                  </template>
                  <template v-else>
                    {{ formatStat(column.field, summaryData[column.field]) }}
                  </template>
                </TableCell>
              </TableRow>
            </TableFooter>
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
/* The preferences trigger and popover are styled in main.css, not here. The
   popover is teleported out of this component by PopoverPortal so the scope
   attribute never reaches it, and both have to override modal-scale
   `[role="dialog"]` rules that are !important inside a cascade layer - which
   unlayered scoped styles cannot beat, since layer order reverses for
   important declarations. */

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

/* Career best in a column. The scoped attribute takes this past the .text-gray-300
   utility on the same cell, so no !important is needed. */
.stat-career-best {
  color: hsl(var(--primary));
  font-weight: 700;
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
