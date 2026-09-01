import { useStorage } from '@vueuse/core';
import { VIEWS } from '@/constants/constants';

export interface ScoresPreferences {
  conferenceFilter: string;
  selectedView: string;
  useShortNames: boolean;
  hideScores: boolean;
  hideFinishedGames: boolean;
}

const DEFAULT_PREFERENCES: ScoresPreferences = {
  conferenceFilter: 'ALL',
  selectedView: VIEWS.DEFAULT,
  useShortNames: true,
  hideScores: false,
  hideFinishedGames: false,
};

export const useScoresPreferences = () => {
  const preferences = useStorage<ScoresPreferences>(
    'nba-scores-preferences',
    // A factory, not the object itself — useStorage assigns this value
    // directly as the ref's initial contents when storage is empty, so a
    // shared object literal here would let one instance's mutations leak
    // into every other instance's "default".
    () => ({ ...DEFAULT_PREFERENCES }),
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
