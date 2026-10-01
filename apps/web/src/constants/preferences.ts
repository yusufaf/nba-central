import type { SeasonFormat, StatDisplayMode } from '@/constants/playerStats';
import { DRAWER_SIDES, VIEWS } from '@/constants/constants';
import type { DrawerSide } from '@/models/types';

export interface PlayerStatsPreferences {
    seasonFormat: SeasonFormat;
    statMode: StatDisplayMode;
    showCareerSummary: boolean;
    highlightCareerHighs: boolean;
}

export interface ScoresPreferences {
    conferenceFilter: string;
    selectedView: string;
    useShortNames: boolean;
    hideScores: boolean;
    hideFinishedGames: boolean;
}

export type UndoToastSeconds = '5' | '8' | '15' | '30';

export interface TeamBuilderPreferences {
    confirmDestructive: boolean;
    undoToastSeconds: UndoToastSeconds;
    flipNewCards: boolean;
    drawerSide: DrawerSide;
}

export interface PreferenceSections {
    playerStats: PlayerStatsPreferences;
    scores: ScoresPreferences;
    teamBuilder: TeamBuilderPreferences;
}

export type PreferenceSection = keyof PreferenceSections;

// Each section is one localStorage entry when signed out, and the
// "<section>.<field>" keys of the server's settings map when signed in.
export const PREFERENCE_SECTIONS: {
    [S in PreferenceSection]: { storageKey: string; defaults: PreferenceSections[S] };
} = {
    playerStats: {
        storageKey: 'nba-player-stats-preferences',
        defaults: {
            seasonFormat: 'YYYY-YY', // Standard NBA format (e.g. 2010-11)
            statMode: 'per_game',
            showCareerSummary: true,
            highlightCareerHighs: true,
        },
    },
    scores: {
        storageKey: 'nba-scores-preferences',
        defaults: {
            conferenceFilter: 'ALL',
            selectedView: VIEWS.DEFAULT,
            useShortNames: true,
            hideScores: false,
            hideFinishedGames: false,
        },
    },
    // Each default is what the builder did before these were settings.
    teamBuilder: {
        storageKey: 'nba-team-builder-preferences',
        defaults: {
            confirmDestructive: true,
            undoToastSeconds: '8',
            flipNewCards: false,
            drawerSide: DRAWER_SIDES.RIGHT,
        },
    },
};
