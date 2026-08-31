<script setup lang="ts">
import { computed } from "vue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  STAT_COLUMNS,
  careerAverages,
  formatStat,
  isBetter,
} from "@/constants/playerStats";
import { ratingTier, ratingSourceLabel } from "@/constants/ratings";

const props = defineProps<{
  visible: boolean;
  player1: any;
  player2: any;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const dialogModel = computed({
  get: () => props.visible,
  set: (value) => emit("update:visible", value),
});

const onClose = () => {
  dialogModel.value = false;
};

// Season is per-row and games played is a total, so neither belongs in a
// career-rate comparison.
const comparedColumns = STAT_COLUMNS.filter(
  (column) => column.name !== "season" && column.name !== "games_played",
);

const careerOf = (player: any) => careerAverages(player?.playerStats);

const career1 = computed(() => careerOf(props.player1));
const career2 = computed(() => careerOf(props.player2));

const ratingOf = (player: any): number | null =>
  player?.rating ?? player?.overallRating ?? null;

type ComparisonRow = {
  name: string;
  label: string;
  title: string;
  left?: number;
  right?: number;
  leftWins: boolean;
  rightWins: boolean;
};

const rows = computed<ComparisonRow[]>(() =>
  comparedColumns.map((column) => {
    const left = career1.value?.[column.field];
    const right = career2.value?.[column.field];
    const comparable = Number.isFinite(left) && Number.isFinite(right);
    return {
      name: column.name,
      label: column.label,
      title: column.title,
      left,
      right,
      // A tie highlights neither side.
      leftWins: comparable && isBetter(column.name, left!, right!),
      rightWins: comparable && isBetter(column.name, right!, left!),
    };
  }),
);

const summary = computed(() => ({
  left: rows.value.filter((row) => row.leftWins).length,
  right: rows.value.filter((row) => row.rightWins).length,
}));

const headerFor = (player: any, career: ReturnType<typeof careerOf>) => ({
  name: player?.fullName ?? "—",
  rating: ratingOf(player),
  ratingSource: player?.isCustom ? undefined : player?.ratingSource,
  seasons: career?.seasons ?? 0,
  games: career?.games_played ?? 0,
});
</script>

<template>
  <Dialog v-model:open="dialogModel">
    <!-- Deliberately not `wide-dialog`: this is three columns, not the stats
         table's twenty-one. The default width keeps each player's numbers
         directly under their name. -->
    <DialogContent class="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Player Comparison</DialogTitle>
      </DialogHeader>

      <div v-if="!career1 || !career2" class="comparison-empty">
        Career stats aren't loaded for both players yet. Close this, open each
        player's stats once, then compare again.
      </div>

      <TooltipProvider v-else :delay-duration="200">
        <div class="comparison">
          <!-- Header: who is being compared -->
          <div class="comparison-row comparison-head">
            <div
              v-for="(side, index) in [
                headerFor(player1, career1),
                headerFor(player2, career2),
              ]"
              :key="index"
              class="comparison-player"
              :class="{ 'comparison-player-right': index === 1 }"
            >
              <span class="comparison-name">{{ side.name }}</span>
              <span
                v-if="side.rating !== null"
                class="comparison-rating"
                :class="`rating-${ratingTier(side.rating)}`"
                :title="ratingSourceLabel(side.ratingSource)"
              >
                {{ side.rating }} OVR
              </span>
              <span class="comparison-meta">
                {{ side.seasons }} season{{ side.seasons === 1 ? '' : 's' }} ·
                {{ side.games }} games
              </span>
            </div>
          </div>

          <p class="comparison-caption">
            Career per-game averages, weighted by games played. Shooting
            percentages are recomputed from makes and attempts.
          </p>

          <!-- One row per stat, better value highlighted -->
          <div
            v-for="row in rows"
            :key="row.name"
            class="comparison-row"
          >
            <div class="comparison-value" :class="{ 'is-better': row.leftWins }">
              {{ formatStat(row.name, row.left) }}
            </div>

            <div class="comparison-label">
              <Tooltip>
                <TooltipTrigger as="span" class="comparison-stat">
                  {{ row.label }}
                </TooltipTrigger>
                <TooltipContent>{{ row.title }}</TooltipContent>
              </Tooltip>
            </div>

            <div class="comparison-value" :class="{ 'is-better': row.rightWins }">
              {{ formatStat(row.name, row.right) }}
            </div>
          </div>

          <div class="comparison-row comparison-total">
            <div class="comparison-value" :class="{ 'is-better': summary.left > summary.right }">
              {{ summary.left }}
            </div>
            <div class="comparison-label">Categories led</div>
            <div class="comparison-value" :class="{ 'is-better': summary.right > summary.left }">
              {{ summary.right }}
            </div>
          </div>
        </div>
      </TooltipProvider>

      <DialogFooter>
        <Button variant="outline" @click="onClose">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.comparison-empty {
  padding: 2rem 0;
  text-align: center;
  color: hsl(var(--muted-foreground));
}

.comparison {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Value | stat | value. The centre column is fixed so the two number columns
   stay symmetrical regardless of label length. */
.comparison-row {
  display: grid;
  grid-template-columns: 1fr 6rem 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 0.0625rem solid hsl(var(--border) / 0.5);
}

.comparison-row:nth-child(even) {
  background-color: hsl(var(--muted) / 0.15);
}

.comparison-head {
  border-bottom-width: 0.125rem;
  border-bottom-color: hsl(var(--border));
  padding-bottom: 1rem;
  grid-template-columns: 1fr 1fr;
  background-color: transparent;
}

.comparison-player {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.comparison-player-right {
  align-items: flex-end;
  text-align: right;
}

.comparison-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.comparison-rating {
  align-self: flex-start;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  border: 0.0625rem solid;
  font-size: 0.8125rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: default;
}

.comparison-player-right .comparison-rating {
  align-self: flex-end;
}

.comparison-meta {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.comparison-caption {
  padding: 0.75rem 0.75rem 0.5rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.comparison-value {
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.comparison-value:first-child {
  text-align: right;
}

.comparison-value:last-child {
  text-align: left;
}

.is-better {
  color: hsl(var(--primary));
  font-weight: 700;
}

.comparison-label {
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.comparison-stat {
  cursor: help;
  text-decoration: underline dotted hsl(var(--muted-foreground) / 0.6);
  text-underline-offset: 0.25rem;
}

.comparison-total {
  border-bottom: none;
  border-top: 0.125rem solid hsl(var(--border));
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  font-size: 1.125rem;
  background-color: transparent;
}

.comparison-total .comparison-label {
  font-size: 0.875rem;
  color: hsl(var(--foreground));
}

/* Rating tiers - same bands as PlayerSlot's card badge */
.rating-elite {
  color: hsl(45 93% 58%);
  border-color: hsl(45 93% 58% / 0.5);
  background-color: hsl(45 93% 58% / 0.12);
}

.rating-great {
  color: hsl(142 71% 45%);
  border-color: hsl(142 71% 45% / 0.5);
  background-color: hsl(142 71% 45% / 0.12);
}

.rating-good {
  color: hsl(199 89% 55%);
  border-color: hsl(199 89% 55% / 0.5);
  background-color: hsl(199 89% 55% / 0.12);
}

.rating-average {
  color: hsl(var(--muted-foreground));
  border-color: hsl(var(--muted-foreground) / 0.4);
  background-color: hsl(var(--muted-foreground) / 0.1);
}
</style>
