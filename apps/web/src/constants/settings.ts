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
