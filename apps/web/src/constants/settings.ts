// The settings keys the API accepts, mirrored from
// apps/cdk/models/user-settings.ts — the server rejects anything outside this
// list with a 400, and apps/cdk's test/utilities/user-settings.test.ts fails
// if the two copies drift. Keep this file free of imports so that test can
// load it outside Vite.
export type SettingRule =
    | { type: 'boolean' }
    | { type: 'enum'; values: readonly string[] };

export const SETTINGS_SCHEMA = {
    'playerStats.seasonFormat': {
        type: 'enum',
        values: ['YYYY-YY', 'YYYY-YYYY', 'YYYY', 'YYYY+1'],
    },
    'playerStats.statMode': { type: 'enum', values: ['per_game', 'totals'] },
    'playerStats.showCareerSummary': { type: 'boolean' },
    'playerStats.highlightCareerHighs': { type: 'boolean' },
    'scores.conferenceFilter': {
        type: 'enum',
        values: ['ALL', 'EAST', 'WEST', 'CROSS'],
    },
    'scores.selectedView': { type: 'enum', values: ['Default', 'List'] },
    'scores.useShortNames': { type: 'boolean' },
    'scores.hideScores': { type: 'boolean' },
    'scores.hideFinishedGames': { type: 'boolean' },
    'teamBuilder.confirmDestructive': { type: 'boolean' },
    // Seconds, as strings: an enum keeps the allowed durations a closed set
    // without a numeric rule type.
    'teamBuilder.undoToastSeconds': {
        type: 'enum',
        values: ['5', '8', '15', '30'],
    },
    'teamBuilder.flipNewCards': { type: 'boolean' },
    'teamBuilder.drawerSide': { type: 'enum', values: ['left', 'right'] },
    // "auto" keeps each date and time as the app showed it before these
    // settings existed (some follow the browser locale, some are en-US).
    'display.dateFormat': {
        type: 'enum',
        values: ['auto', 'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'],
    },
    'display.timeFormat': { type: 'enum', values: ['auto', '12h', '24h'] },
    'display.reducedMotion': {
        type: 'enum',
        values: ['system', 'reduce', 'allow'],
    },
    // Root font size as a percentage of the browser default, as strings for
    // the same reason as undoToastSeconds.
    'display.fontScale': {
        type: 'enum',
        values: ['87.5', '100', '112.5', '125', '137.5'],
    },
    // "system" follows the device's light/dark setting.
    'display.theme': { type: 'enum', values: ['system', 'light', 'dark'] },
    // Which avatar the profile card and header show. "generated-N" is the
    // Nth DiceBear avatar seeded by the user's id, rendered in the browser;
    // "upload" is the image uploadAvatar stored. Never a URL: uploadAvatar
    // writes that onto the user's item itself.
    'profile.avatar': {
        type: 'enum',
        values: [
            'none',
            'generated-0',
            'generated-1',
            'generated-2',
            'generated-3',
            'generated-4',
            'generated-5',
            'generated-6',
            'generated-7',
            'upload',
        ],
    },
} as const satisfies Record<string, SettingRule>;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type SettingValue = string | boolean;
export type SettingsMap = Partial<Record<SettingKey, SettingValue>>;

export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

export const isValidSetting = (key: string, value: unknown): boolean => {
    if (!Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key)) return false;
    const rule: SettingRule = SETTINGS_SCHEMA[key as SettingKey];
    if (rule.type === 'boolean') return typeof value === 'boolean';
    return typeof value === 'string' && rule.values.includes(value);
};
