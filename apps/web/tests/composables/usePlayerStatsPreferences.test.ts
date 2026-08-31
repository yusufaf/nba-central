import { describe, it, expect } from 'vitest';
import { usePlayerStatsPreferences } from '@/composables/usePlayerStatsPreferences';

describe('usePlayerStatsPreferences', () => {
  it('provides default preferences', () => {
    const { preferences } = usePlayerStatsPreferences();
    expect(preferences.value.seasonFormat).toBe('YYYY-YY');
    expect(preferences.value.statMode).toBe('per_game');
    expect(preferences.value.showCareerSummary).toBe(true);
  });

  it('allows updating preferences', () => {
    const { preferences } = usePlayerStatsPreferences();
    preferences.value.seasonFormat = 'YYYY';
    expect(preferences.value.seasonFormat).toBe('YYYY');
  });

  it('resets preferences back to defaults', () => {
    const { preferences, resetPreferences } = usePlayerStatsPreferences();
    preferences.value.seasonFormat = 'YYYY+1';
    preferences.value.statMode = 'totals';
    preferences.value.showCareerSummary = false;

    resetPreferences();

    expect(preferences.value.seasonFormat).toBe('YYYY-YY');
    expect(preferences.value.statMode).toBe('per_game');
    expect(preferences.value.showCareerSummary).toBe(true);
  });
});
