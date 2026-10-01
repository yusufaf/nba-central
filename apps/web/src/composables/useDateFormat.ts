import {
  formatDate as formatDateWith,
  formatDateTime as formatDateTimeWith,
  formatTime as formatTimeWith,
  type DateStyle,
} from '@/utils/date';
import { useDisplayPreferences } from '@/composables/useDisplayPreferences';

type DateInput = Date | string | number;

/**
 * The formatters in utils/date.ts, bound to the user's date and time
 * format. They read the preference when called, so a computed or template
 * that calls them updates when the setting changes.
 */
export const useDateFormat = () => {
  const { preferences } = useDisplayPreferences();

  return {
    formatDate: (date: DateInput, style: DateStyle) =>
      formatDateWith(date, style, preferences.value.dateFormat),
    formatTime: (date: DateInput) => formatTimeWith(date, preferences.value.timeFormat),
    formatDateTime: (date: DateInput) =>
      formatDateTimeWith(date, preferences.value.dateFormat, preferences.value.timeFormat),
  };
};
