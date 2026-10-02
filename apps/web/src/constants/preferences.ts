import type { SeasonFormat, StatDisplayMode } from '@/constants/playerStats';
import { DRAWER_SIDES, VIEWS } from '@/constants/constants';
import type { DrawerSide } from '@/models/types';
import type { DateFormat, TimeFormat } from '@/utils/date';

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

export type ReducedMotion = 'system' | 'reduce' | 'allow';
export type FontScale = '87.5' | '100' | '112.5' | '125' | '137.5';
export const FONT_SCALES: readonly FontScale[] = ['87.5', '100', '112.5', '125', '137.5'];

export interface DisplayPreferences {
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
    reducedMotion: ReducedMotion;
    fontScale: FontScale;
}

export const GENERATED_AVATAR_COUNT = 8;
export type GeneratedAvatar = `generated-${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type AvatarChoice = 'none' | GeneratedAvatar | 'upload';

export interface ProfilePreferences {
    avatar: AvatarChoice;
}

export interface PreferenceSections {
    playerStats: PlayerStatsPreferences;
    scores: ScoresPreferences;
    teamBuilder: TeamBuilderPreferences;
    display: DisplayPreferences;
    profile: ProfilePreferences;
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
    // "auto" and "system" are what the app did before: each date as its page
    // always wrote it, motion as the OS asks, and the browser's font size.
    display: {
        storageKey: 'nba-display-preferences',
        defaults: {
            dateFormat: 'auto',
            timeFormat: 'auto',
            reducedMotion: 'system',
            fontScale: '100',
        },
    },
    // Signed in only: the avatar picker is on Settings, behind sign-in, so
    // nothing writes this section to localStorage in practice.
    profile: {
        storageKey: 'nba-profile-preferences',
        defaults: {
            avatar: 'none',
        },
    },
};
