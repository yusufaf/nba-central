import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useScoresPreferences } from '@/composables/useScoresPreferences';

describe('useScoresPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default preferences', () => {
    const { preferences } = useScoresPreferences();
    expect(preferences.value.conferenceFilter).toBe('ALL');
    expect(preferences.value.selectedView).toBe('Default');
    expect(preferences.value.useShortNames).toBe(true);
    expect(preferences.value.hideScores).toBe(false);
    expect(preferences.value.hideFinishedGames).toBe(false);
  });

  it('allows updating preferences', () => {
    const { preferences } = useScoresPreferences();
    preferences.value.conferenceFilter = 'EAST';
    expect(preferences.value.conferenceFilter).toBe('EAST');
  });

  it('persists preferences across composable instances', async () => {
    const first = useScoresPreferences();
    first.preferences.value.conferenceFilter = 'WEST';
    first.preferences.value.hideScores = true;
    await nextTick();

    const second = useScoresPreferences();
    expect(second.preferences.value.conferenceFilter).toBe('WEST');
    expect(second.preferences.value.hideScores).toBe(true);
  });

  it('resets preferences back to defaults', () => {
    const { preferences, resetPreferences } = useScoresPreferences();
    preferences.value.conferenceFilter = 'CROSS';
    preferences.value.selectedView = 'List';
    preferences.value.useShortNames = false;
    preferences.value.hideScores = true;
    preferences.value.hideFinishedGames = true;

    resetPreferences();

    expect(preferences.value.conferenceFilter).toBe('ALL');
    expect(preferences.value.selectedView).toBe('Default');
    expect(preferences.value.useShortNames).toBe(true);
    expect(preferences.value.hideScores).toBe(false);
    expect(preferences.value.hideFinishedGames).toBe(false);
  });
});
