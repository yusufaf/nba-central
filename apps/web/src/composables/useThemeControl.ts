import { computed } from 'vue';
import { useDisplayPreferences } from '@/composables/useDisplayPreferences';
import { useSettingsSync } from '@/composables/useSettingsSync';
import { THEME_OPTIONS, type Theme } from '@/constants/preferences';

/**
 * Should a value coming out of a theme control be written to the setting?
 * `disabled` is true while a save is in flight or settings are loading.
 */
export const shouldApplyTheme = (value: unknown, disabled: boolean): value is Theme => {
  // '' is a single-select ToggleGroup's deselect; keep the current theme.
  return !disabled && THEME_OPTIONS.some((option) => option.value === value);
};

/**
 * The Theme setting for the header's controls. Same value Settings edits:
 * localStorage when signed out, the synced setting when signed in.
 */
export const useThemeControl = () => {
  const { preferences } = useDisplayPreferences();
  const { status, isSaving } = useSettingsSync();

  // While settings load, a write would land in localStorage and then be
  // overwritten by the server copy, so the control waits.
  const disabled = computed(() => status.value === 'loading' || isSaving('display.theme'));

  const setTheme = (value: unknown) => {
    if (shouldApplyTheme(value, disabled.value)) preferences.value.theme = value;
  };

  return { theme: computed(() => preferences.value.theme), disabled, setTheme, options: THEME_OPTIONS };
};
