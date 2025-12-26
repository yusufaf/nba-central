<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

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
  slotIndex: number;
  player?: Player | null;
  position?: string;
  isFlipped?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  player: null,
  position: undefined,
  isFlipped: false,
});

const emit = defineEmits<{
  'add': [index: number];
  'remove': [index: number];
  'flip': [index: number];
  'viewStats': [index: number];
  'compare': [index: number];
}>();

const hasPlayer = computed(() => !!props.player);
const playerInitials = computed(() => {
  if (!props.player) return '?';
  return `${props.player.first_name[0]}${props.player.last_name[0]}`;
});

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
  <div class="player-card-wrapper">
    <Card class="player-card">
      <CardHeader class="card-header">
        <div class="flex items-center justify-between w-full">
          <Badge variant="secondary" class="position-badge">
            {{ position || `Slot ${slotIndex}` }}
          </Badge>
          <Button
            v-if="hasPlayer"
            @click.stop="emit('remove', slotIndex)"
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <i class="material-icons text-sm">close</i>
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent class="main-content" @click="hasPlayer ? emit('flip', slotIndex) : undefined" :class="{ 'cursor-pointer': hasPlayer }">
        <!-- Empty State -->
        <template v-if="!hasPlayer">
          <div class="empty-state">
            <div class="empty-icon-wrapper">
              <i class="material-icons empty-icon">person_add</i>
            </div>
            <p class="empty-text">No player selected</p>
            <Button
              @click.stop="emit('add', slotIndex)"
              variant="default"
              size="sm"
              class="add-button"
            >
              <i class="material-icons mr-1 text-base">add</i>
              Add Player
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
            <h4 class="player-name">
              {{ player.fullName }}
            </h4>
            <div class="player-meta">
              <span class="meta-item">{{ player.team.abbreviation }}</span>
              <span class="meta-divider">•</span>
              <span class="meta-item">{{ player.position }}</span>
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
              <i class="material-icons mr-1 text-base">analytics</i>
              View Stats
            </Button>
            <Button
              @click.stop="emit('add', slotIndex)"
              variant="outline"
              size="sm"
              class="action-btn"
            >
              <i class="material-icons mr-1 text-base">swap_horiz</i>
              Replace
            </Button>
            <Button
              @click.stop="emit('compare', slotIndex)"
              variant="outline"
              size="sm"
              class="action-btn"
            >
              <i class="material-icons mr-1 text-base">compare_arrows</i>
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
  border-color: hsla(var(--primary), 0.5);
  transition: all 0.2s ease;
}

.player-card-wrapper:hover {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0.5rem hsla(var(--primary), 0.3);
}

.player-card {
  border: none !important;
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
  font-size: 2rem;
  color: hsl(var(--muted-foreground));
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
  border: 2px solid hsl(var(--border));
}

.avatar-fallback {
  background: linear-gradient(135deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--primary) / 0.1) 100%);
  color: hsl(var(--primary));
  font-size: 1.25rem;
  font-weight: 700;
  border: 2px solid hsl(var(--primary) / 0.3);
}

.player-name {
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
  margin: 0.25rem 0 0;
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
