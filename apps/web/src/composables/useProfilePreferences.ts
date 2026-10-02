import { useStorage } from '@vueuse/core';
import {
  PREFERENCE_SECTIONS,
  type ProfilePreferences,
} from '@/constants/preferences';
import { useSyncedPreferences } from '@/composables/useSettingsSync';

export type { ProfilePreferences };

const { storageKey, defaults: DEFAULT_PREFERENCES } = PREFERENCE_SECTIONS.profile;

export const useProfilePreferences = () => {
  const localPreferences = useStorage<ProfilePreferences>(
    storageKey,
    // A factory, not the object itself — see usePlayerStatsPreferences.
    () => ({ ...DEFAULT_PREFERENCES }),
    undefined,
    { mergeDefaults: true }
  );
  const preferences = useSyncedPreferences('profile', localPreferences);

  return { preferences };
};
