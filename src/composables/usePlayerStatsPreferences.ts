import { useStorage } from '@vueuse/core';
import type { SeasonFormat, StatDisplayMode } from '@/constants/playerStats';

export interface PlayerStatsPreferences {
  seasonFormat: SeasonFormat;
  statMode: StatDisplayMode;
  showCareerSummary: boolean;
  highlightCareerHighs: boolean;
}

const DEFAULT_PREFERENCES: PlayerStatsPreferences = {
  seasonFormat: 'YYYY-YY', // Standard NBA format (e.g. 2010-11)
  statMode: 'per_game',
  showCareerSummary: true,
  highlightCareerHighs: true,
};

export const usePlayerStatsPreferences = () => {
  const preferences = useStorage<PlayerStatsPreferences>(
    'nba-player-stats-preferences',
    DEFAULT_PREFERENCES,
    undefined,
    // Without this, anyone with preferences already in localStorage gets
    // `undefined` for every key added after they first saved them.
    { mergeDefaults: true }
  );

  const resetPreferences = () => {
    preferences.value = { ...DEFAULT_PREFERENCES };
  };

  return {
    preferences,
    resetPreferences,
  };
};
