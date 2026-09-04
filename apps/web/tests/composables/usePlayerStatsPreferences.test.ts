import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStatsPreferences } from '@/composables/usePlayerStatsPreferences';

describe('usePlayerStatsPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default preferences', () => {
    const { preferences } = usePlayerStatsPreferences();
    expect(preferences.value.seasonFormat).toBe('YYYY-YY');
    expect(preferences.value.statMode).toBe('per_game');
    expect(preferences.value.showCareerSummary).toBe(true);
    expect(preferences.value.highlightCareerHighs).toBe(true);
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
    preferences.value.highlightCareerHighs = false;

    resetPreferences();

    expect(preferences.value.seasonFormat).toBe('YYYY-YY');
    expect(preferences.value.statMode).toBe('per_game');
    expect(preferences.value.showCareerSummary).toBe(true);
    expect(preferences.value.highlightCareerHighs).toBe(true);
  });

  it("does not leak one instance's mutations into another's defaults", () => {
    const first = usePlayerStatsPreferences();
    first.preferences.value.statMode = 'totals';
    first.preferences.value.showCareerSummary = false;

    localStorage.clear();

    const second = usePlayerStatsPreferences();
    expect(second.preferences.value.statMode).toBe('per_game');
    expect(second.preferences.value.showCareerSummary).toBe(true);
  });
});
