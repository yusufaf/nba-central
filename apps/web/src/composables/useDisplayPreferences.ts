import { computed, watchEffect } from 'vue';
import { useStorage, usePreferredReducedMotion } from '@vueuse/core';
import {
  PREFERENCE_SECTIONS,
  type DisplayPreferences,
} from '@/constants/preferences';
import { useSyncedPreferences } from '@/composables/useSettingsSync';

export type { DisplayPreferences };

const { storageKey, defaults: DEFAULT_PREFERENCES } = PREFERENCE_SECTIONS.display;

export const useDisplayPreferences = () => {
  const localPreferences = useStorage<DisplayPreferences>(
    storageKey,
    // A factory, not the object itself — see usePlayerStatsPreferences.
    () => ({ ...DEFAULT_PREFERENCES }),
    undefined,
    { mergeDefaults: true }
  );
  const preferences = useSyncedPreferences('display', localPreferences);

  return { preferences };
};

/** True when animation should stay off: the setting, or the OS when it's "system". */
export const useReducedMotion = () => {
  const { preferences } = useDisplayPreferences();
  const os = usePreferredReducedMotion();

  return computed(() => {
    const setting = preferences.value.reducedMotion;
    return setting === 'reduce' || (setting === 'system' && os.value === 'reduce');
  });
};

/**
 * Puts the display settings on <html>, the way main.ts puts `dark` there:
 * `.reduce-motion` for main.css and the `motion-reduce:` variant to key off,
 * and the font scale as the root font size, which every rem follows. Called
 * once from App.vue.
 */
export const applyDisplayPreferences = (root: HTMLElement = document.documentElement) => {
  const reduceMotion = useReducedMotion();
  const { preferences } = useDisplayPreferences();

  watchEffect(() => {
    root.classList.toggle('reduce-motion', reduceMotion.value);
    // The default leaves the browser's own font size in charge, as before.
    const scale = preferences.value.fontScale;
    root.style.fontSize = scale === '100' ? '' : `${scale}%`;
  });
};
