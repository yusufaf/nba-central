import { computed, watch, watchEffect } from 'vue';
import { useStorage, usePreferredDark, usePreferredReducedMotion } from '@vueuse/core';
import {
  PREFERENCE_SECTIONS,
  type DisplayPreferences,
} from '@/constants/preferences';
import { useSyncedPreferences } from '@/composables/useSettingsSync';

export type { DisplayPreferences };

const { storageKey, defaults: DEFAULT_PREFERENCES } = PREFERENCE_SECTIONS.display;

const useLocalDisplayPreferences = () =>
  useStorage<DisplayPreferences>(
    storageKey,
    // A factory, not the object itself — see usePlayerStatsPreferences.
    () => ({ ...DEFAULT_PREFERENCES }),
    undefined,
    { mergeDefaults: true }
  );

export const useDisplayPreferences = () => {
  const preferences = useSyncedPreferences('display', useLocalDisplayPreferences());

  return { preferences };
};

/** The theme in effect: the setting, or the OS when it's "system". */
export const useResolvedTheme = () => {
  const { preferences } = useDisplayPreferences();
  const osDark = usePreferredDark();

  return computed(() => {
    const setting = preferences.value.theme;
    if (setting === 'system') return osDark.value ? 'dark' : 'light';
    return setting;
  });
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
 * Puts the display settings on <html>: `.dark` for the dark tokens and the
 * `dark:` variant, `.reduce-motion` for main.css and the `motion-reduce:`
 * variant to key off, and the font scale as the root font size, which every
 * rem follows. Called once from App.vue.
 *
 * index.html sets `.dark` before the first paint from this device's copy of
 * the setting. Signed in, the setting lives on the server, so the theme (and
 * only the theme) is copied to this device as well. That also keeps the
 * theme as it was after signing out.
 */
export const applyDisplayPreferences = (root: HTMLElement = document.documentElement) => {
  const reduceMotion = useReducedMotion();
  const theme = useResolvedTheme();
  const { preferences } = useDisplayPreferences();
  const localPreferences = useLocalDisplayPreferences();

  watchEffect(() => {
    root.classList.toggle('dark', theme.value === 'dark');
    root.classList.toggle('reduce-motion', reduceMotion.value);
    // The default leaves the browser's own font size in charge, as before.
    const scale = preferences.value.fontScale;
    root.style.fontSize = scale === '100' ? '' : `${scale}%`;
  });

  watch(
    () => preferences.value.theme,
    (setting) => {
      if (localPreferences.value.theme !== setting) {
        localPreferences.value = { ...localPreferences.value, theme: setting };
      }
    },
    { immediate: true }
  );
};
