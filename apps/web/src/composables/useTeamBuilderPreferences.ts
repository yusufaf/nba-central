import { computed } from 'vue';
import { useStorage } from '@vueuse/core';
import {
  PREFERENCE_SECTIONS,
  type TeamBuilderPreferences,
} from '@/constants/preferences';
import { useSyncedPreferences } from '@/composables/useSettingsSync';

export type { TeamBuilderPreferences };

const { storageKey, defaults: DEFAULT_PREFERENCES } = PREFERENCE_SECTIONS.teamBuilder;

export const useTeamBuilderPreferences = () => {
  const localPreferences = useStorage<TeamBuilderPreferences>(
    storageKey,
    // A factory, not the object itself — see usePlayerStatsPreferences.
    () => ({ ...DEFAULT_PREFERENCES }),
    undefined,
    { mergeDefaults: true }
  );
  const preferences = useSyncedPreferences('teamBuilder', localPreferences);

  const undoToastDuration = computed(() => Number(preferences.value.undoToastSeconds) * 1000);

  // Turning confirmations off only drops the ones undo can stand in for.
  // Deleting a saved team or a custom coach/GM/player can't be taken back,
  // so those always ask.
  const shouldConfirm = ({ undoable }: { undoable: boolean }) =>
    !undoable || preferences.value.confirmDestructive;

  return {
    preferences,
    undoToastDuration,
    shouldConfirm,
  };
};
