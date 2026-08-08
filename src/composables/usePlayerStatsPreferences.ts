import { useStorage } from '@vueuse/core';
import type { SeasonFormat, StatDisplayMode } from '@/constants/playerStats';

export interface PlayerStatsPreferences {
  seasonFormat: SeasonFormat;
  statMode: StatDisplayMode;
  showCareerSummary: boolean;
}

const DEFAULT_PREFERENCES: PlayerStatsPreferences = {
  seasonFormat: 'YYYY-YY', // Standard NBA format (e.g. 2010-11)
  statMode: 'per_game',
  showCareerSummary: true,
};

export const usePlayerStatsPreferences = () => {
  const preferences = useStorage<PlayerStatsPreferences>(
    'nba-player-stats-preferences',
    DEFAULT_PREFERENCES
  );

  const resetPreferences = () => {
    preferences.value = { ...DEFAULT_PREFERENCES };
  };

  return {
    preferences,
    resetPreferences,
  };
};
