import { useStorage } from '@vueuse/core';
import {
  PREFERENCE_SECTIONS,
  type ScoresPreferences,
} from '@/constants/preferences';
import { useSyncedPreferences } from '@/composables/useSettingsSync';

export type { ScoresPreferences };

const { storageKey, defaults: DEFAULT_PREFERENCES } = PREFERENCE_SECTIONS.scores;

export const useScoresPreferences = () => {
  const localPreferences = useStorage<ScoresPreferences>(
    storageKey,
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
  // Signed out this is localPreferences, exactly as before; signed in it's
  // the server's copy, saved field by field.
  const preferences = useSyncedPreferences('scores', localPreferences);

  const resetPreferences = () => {
    preferences.value = { ...DEFAULT_PREFERENCES };
  };

  return {
    preferences,
    resetPreferences,
  };
};
