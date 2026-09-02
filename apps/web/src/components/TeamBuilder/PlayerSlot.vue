<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { X, UserPlus, Plus, BarChart3, ArrowLeftRight, GitCompareArrows, GripVertical, Loader2 } from 'lucide-vue-next';
import { getWikipediaUrl } from '@/constants/utilities';
import ExternalLinksMenu from '@/components/ExternalLinksMenu.vue';
import { ratingTier, ratingSourceLabel } from '@/constants/ratings';
import type { RatingSource } from '@/models/types';

interface Player {
  id: string;
  fullName: string;
  first_name: string;
  last_name: string;
  position: string;
  team: {
    full_name: string;
    abbreviation: string;
  };
  playerStats?: any[];
  isCustom?: boolean;
  rating?: number;
  ratingSource?: RatingSource;
  overallRating?: number;
}

interface Props {
  slotIndex: number;
  player?: Player | null;
  position?: string;
  /** Name of the player being fetched into this slot, while that is in flight. */
  pendingName?: string;
  isFlipped?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isPickedUp?: boolean;
  /** True while some card - anywhere in the roster - is held by the keyboard flow. */
  isPickupActive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  player: null,
  position: undefined,
  pendingName: undefined,
  isFlipped: false,
  isDragging: false,
  isDropTarget: false,
  isPickedUp: false,
  isPickupActive: false,
});

const emit = defineEmits<{
  'add': [index: number];
  'remove': [index: number];
  'flip': [index: number];
  'viewStats': [index: number];
  'compare': [index: number];
  'dragStart': [index: number, event: DragEvent];
  'dragEnd': [];
  'dragOver': [index: number, event: DragEvent];
  'dragLeave': [index: number];
  'drop': [index: number, event: DragEvent];
  'pickup': [index: number];
}>();

const hasPlayer = computed(() => !!props.player);
// The player lands in the slot only once their stats have been fetched, so a
// pending slot is still empty - it just shouldn't offer to be filled again.
const isPending = computed(() => !props.player && !!props.pendingName);
const slotLabel = computed(() => props.position || `Slot ${props.slotIndex}`);
const moveLabel = computed(() => {
  if (props.isPickedUp) return `Put ${props.player?.fullName} back in ${slotLabel.value}`;
  if (props.isPickupActive) return `Swap into ${slotLabel.value}`;
  return `Move ${props.player?.fullName} from ${slotLabel.value}`;
});
const playerInitials = computed(() => {
  if (!props.player) return '?';
  return `${props.player.first_name[0]}${props.player.last_name[0]}`;
});

// Real players carry a 2K rating; custom players carry the one the user typed.
// Both are 0-99, so the card renders them the same way.
const displayRating = computed(
  () => props.player?.rating ?? props.player?.overallRating ?? null,
);

const ratingLabel = computed(() =>
  ratingSourceLabel(props.player?.isCustom ? undefined : props.player?.ratingSource),
);

const averageStats = computed(() => {
  if (!props.player?.playerStats?.length) return null;
  const latestSeason = props.player.playerStats[0];
  return {
    ppg: latestSeason.pts?.toFixed(1) || 'N/A',
    rpg: latestSeason.reb?.toFixed(1) || 'N/A',
    apg: latestSeason.ast?.toFixed(1) || 'N/A',
  };
});
</script>

<template>
  <div
    class="player-card-wrapper"
    :class="{
      'is-draggable': hasPlayer,
      'is-dragging': isDragging,
      'is-drop-target': isDropTarget,
      'is-picked-up': isPickedUp,
      'is-pending': isPending,
    }"
    :draggable="hasPlayer"
    @dragstart="emit('dragStart', slotIndex, $event)"
    @dragend="emit('dragEnd')"
    @dragover="emit('dragOver', slotIndex, $event)"
    @dragleave="emit('dragLeave', slotIndex)"
    @drop="emit('drop', slotIndex, $event)"
  >
    <Card class="player-card border-0">
      <CardHeader class="card-header">
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2 min-w-0">
            <Button
              v-if="hasPlayer"
              @click.stop="emit('pickup', slotIndex)"
              variant="ghost"
              size="icon"
              class="drag-handle h-7 w-7 text-muted-foreground hover:text-foreground"
              :aria-label="moveLabel"
              :aria-pressed="isPickedUp"
            >
              <GripVertical class="w-4 h-4" />
            </Button>
            <Badge variant="secondary" class="position-badge">
              {{ slotLabel }}
            </Badge>
            <span
              v-if="hasPlayer && displayRating !== null"
              class="rating-badge"
              :class="`rating-${ratingTier(displayRating)}`"
              :title="ratingLabel"
            >
              {{ displayRating }}
            </span>
          </div>
          <Button
            v-if="hasPlayer"
            @click.stop="emit('remove', slotIndex)"
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <X class="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent class="main-content" @click="hasPlayer ? emit('flip', slotIndex) : undefined" :class="{ 'cursor-pointer': hasPlayer }">
        <!-- Pending State - this slot's player is still being fetched -->
        <template v-if="isPending">
          <div class="empty-state" role="status" aria-live="polite">
            <div class="empty-icon-wrapper is-pending">
              <Loader2 class="empty-icon pending-spinner" />
            </div>
            <p class="pending-name">{{ pendingName }}</p>
            <p class="empty-text">Adding to {{ slotLabel }}...</p>
          </div>
        </template>

        <!-- Empty State -->
        <template v-else-if="!hasPlayer">
          <div class="empty-state">
            <div class="empty-icon-wrapper">
              <UserPlus class="empty-icon" />
            </div>
            <p class="empty-text">No player selected</p>
            <Button
              @click.stop="emit('add', slotIndex)"
              variant="default"
              size="sm"
              class="add-button"
            >
              <Plus class="w-4 h-4 mr-1" />
              Add Player
            </Button>
            <!-- Only reachable while a card is held by the keyboard flow -
                 pointer users drop straight onto the card. -->
            <Button
              v-if="isPickupActive"
              @click.stop="emit('pickup', slotIndex)"
              variant="outline"
              size="sm"
              class="add-button"
              :aria-label="`Move held player into ${slotLabel}`"
            >
              <GripVertical class="w-4 h-4 mr-1" />
              Move here
            </Button>
          </div>
        </template>

        <!-- Filled State - Front -->
        <template v-else-if="!isFlipped">
          <div class="player-info">
            <Avatar class="player-avatar">
              <AvatarFallback class="avatar-fallback">
                {{ playerInitials }}
              </AvatarFallback>
            </Avatar>
            <div class="flex items-center justify-center gap-1.5 w-full">
              <h4 class="player-name">
                {{ player?.fullName }}
              </h4>
              <ExternalLinksMenu
                v-if="player && !player.isCustom"
                :links="[{ label: 'Wikipedia', url: getWikipediaUrl(player.fullName) }]"
              />
            </div>
            <div class="player-meta">
              <span v-if="player?.team?.abbreviation" class="meta-item">{{ player.team.abbreviation }}</span>
              <span v-if="player?.team?.abbreviation" class="meta-divider">•</span>
              <span class="meta-item">{{ player?.position }}</span>
            </div>
            <div v-if="averageStats" class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{{ averageStats.ppg }}</div>
                <div class="stat-label">PTS</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ averageStats.rpg }}</div>
                <div class="stat-label">REB</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ averageStats.apg }}</div>
                <div class="stat-label">AST</div>
              </div>
            </div>
          </div>
        </template>

        <!-- Filled State - Back (Flipped) -->
        <template v-else>
          <div class="action-buttons">
            <Button
              @click.stop="emit('viewStats', slotIndex)"
              variant="outline"
              size="sm"
              class="action-btn"
            >
              <BarChart3 class="w-4 h-4 mr-1" />
              View Stats
            </Button>
            <Button
              @click.stop="emit('add', slotIndex)"
              variant="outline"
              size="sm"
              class="action-btn"
            >
              <ArrowLeftRight class="w-4 h-4 mr-1" />
              Replace
            </Button>
            <Button
              @click.stop="emit('compare', slotIndex)"
              variant="outline"
              size="sm"
              class="action-btn"
            >
              <GitCompareArrows class="w-4 h-4 mr-1" />
              Compare
            </Button>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.player-card-wrapper {
  border-radius: 0.5rem;
  border: 0.125rem solid;
  border-color: hsl(var(--primary) / 0.5);
  transition: all 0.2s ease;
}

.player-card-wrapper:hover {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0.5rem hsl(var(--primary) / 0.3);
}

/* Drag & Drop states */
.player-card-wrapper.is-draggable {
  cursor: grab;
}

.player-card-wrapper.is-dragging {
  opacity: 0.4;
  cursor: grabbing;
}

/* The card the pointer is currently over - reads as "release here". */
.player-card-wrapper.is-drop-target {
  border-color: hsl(var(--primary));
  border-style: dashed;
  box-shadow: 0 0 0.75rem hsl(var(--primary) / 0.5);
  transform: scale(1.02);
}

/* Solid rather than dashed: the slot is committed, not awaiting a drop. */
.player-card-wrapper.is-pending {
  border-color: hsl(var(--primary) / 0.6);
  box-shadow: 0 0 0.75rem hsl(var(--primary) / 0.25);
}

/* The card held by the keyboard flow, which persists between keypresses. */
.player-card-wrapper.is-picked-up {
  border-style: dashed;
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0.75rem hsl(var(--primary) / 0.5);
}

.drag-handle {
  cursor: grab;
  flex-shrink: 0;
}

.player-card-wrapper.is-dragging .drag-handle {
  cursor: grabbing;
}

/* Drag feedback is a transform; honour reduced-motion by dropping it. */
@media (prefers-reduced-motion: reduce) {
  .player-card-wrapper {
    transition: none;
  }

  .player-card-wrapper.is-drop-target {
    transform: none;
  }
}

.player-card {
  height: 100%;
  background-color: hsl(var(--card));
}

.card-header {
  padding: 0.75rem 1rem;
}

.position-badge {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

/* Rating Badge */
.rating-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  border: 0.0625rem solid;
  font-size: 0.875rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  cursor: default;
}

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

.main-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  min-height: 13rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
}

.empty-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background-color: hsl(var(--muted) / 0.3);
  margin-bottom: 0.25rem;
}

.empty-icon {
  width: 2rem;
  height: 2rem;
  color: hsl(var(--muted-foreground));
}

/* Pending State */
.empty-icon-wrapper.is-pending {
  background-color: hsl(var(--primary) / 0.12);
}

.pending-spinner {
  color: hsl(var(--primary));
  animation: pending-spin 0.9s linear infinite;
}

@keyframes pending-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pending-spinner {
    animation-duration: 2.5s;
  }
}

.pending-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: hsl(var(--foreground));
  text-align: center;
  margin: 0;
  /* Long names must not widen the card out of its grid track. */
  max-width: 100%;
  overflow-wrap: anywhere;
}

.empty-text {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

.add-button {
  margin-top: 0.25rem;
}

/* Player Info */
.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 0.5rem;
}

.player-avatar {
  height: 4rem;
  width: 4rem;
  border: 0.125rem solid hsl(var(--border));
}

.avatar-fallback {
  background: linear-gradient(135deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--primary) / 0.1) 100%);
  color: hsl(var(--primary));
  font-size: 1.25rem;
  font-weight: 700;
  border: 0.125rem solid hsl(var(--primary) / 0.3);
}

.player-name {
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
  margin: 0.25rem 0 0;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.125rem;
}

.meta-item {
  font-weight: 500;
}

.meta-divider {
  color: hsl(var(--muted-foreground) / 0.5);
}

/* Stats Grid */
.stats-grid {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.75rem;
  width: 100%;
  justify-content: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--primary));
  line-height: 1;
}

.stat-label {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.action-btn {
  width: 100%;
  justify-content: flex-start;
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    gap: 1rem;
  }

  .stat-value {
    font-size: 1.125rem;
  }
}
</style>
