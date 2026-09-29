import { computed, reactive, watch, type Ref, type WritableComputedRef } from 'vue';
import { toast } from 'vue-sonner';
import { settingsApi } from '@/network/api';
import {
    SETTING_KEYS,
    isValidSetting,
    type SettingKey,
    type SettingValue,
    type SettingsMap,
} from '@/constants/settings';
import {
    PREFERENCE_SECTIONS,
    type PreferenceSection,
    type PreferenceSections,
} from '@/constants/preferences';

/*
 * Signed out, every preference lives in localStorage, one entry per section,
 * exactly as it always has. Signed in, the server's copy wins: it is loaded
 * once per session, every change is saved immediately (just the fields that
 * changed), and a failed save puts the field back and says so.
 *
 * The first time an account is seen (the server has never stored settings
 * for it), whatever this browser has locally is uploaded, once. The upload
 * is create-only on the server, so if two devices sign in for the first
 * time together, the second gets the first one's settings back instead of
 * merging its own in. Once the copy exists, no device uploads again.
 *
 * App.vue drives start()/stop() from the Logto session, the same way it
 * wires the access token into api.ts; nothing here reads auth itself, so the
 * preference composables still work outside a component.
 */

export type SettingsStatus = 'signed-out' | 'loading' | 'ready' | 'error';

type SectionValues = Record<string, SettingValue>;

const cloneDefaults = () =>
    Object.fromEntries(
        Object.entries(PREFERENCE_SECTIONS).map(([section, { defaults }]) => [
            section,
            { ...defaults },
        ]),
    ) as unknown as PreferenceSections;

const state = reactive({
    status: 'signed-out' as SettingsStatus,
    userId: null as string | null,
    sections: cloneDefaults(),
    saving: {} as Partial<Record<SettingKey, true>>,
});

const splitKey = (key: SettingKey) => {
    const [section, field] = key.split('.') as [PreferenceSection, string];
    return { section, field };
};

const readField = (key: SettingKey): SettingValue => {
    const { section, field } = splitKey(key);
    return (state.sections[section] as unknown as SectionValues)[field];
};

const writeField = (key: SettingKey, value: SettingValue) => {
    const { section, field } = splitKey(key);
    (state.sections[section] as unknown as SectionValues)[field] = value;
};

const snapshot = (): Record<SettingKey, SettingValue> =>
    Object.fromEntries(SETTING_KEYS.map((key) => [key, readField(key)])) as Record<
        SettingKey,
        SettingValue
    >;

// `sent` is the last value handed to the server per key (what the UI is
// diffed against, so a change is sent once); `confirmed` is the last value
// the server accepted (what a failed save reverts to).
let sent = snapshot();
let confirmed = snapshot();
let loading: Promise<void> | null = null;
// Bumped by stop(), so a load or save that finishes after sign-out (or
// after a different user signed in) is dropped instead of applied.
let generation = 0;
// Keys with a save in flight. A newer change to one of them waits until
// that save settles: two parallel requests for one field can reach the
// server in either order, and the older value would win.
const inFlight = new Set<SettingKey>();
// Set when the user is signed in but who they are couldn't be read, so
// retry() can try that again instead of doing nothing.
let reconnect: (() => Promise<void>) | null = null;

// In place, so an object a caller already holds stays the live one.
const applyServerSettings = (settings: SettingsMap) => {
    Object.entries(cloneDefaults()).forEach(([section, defaults]) => {
        Object.assign(state.sections[section as PreferenceSection], defaults);
    });
    for (const key of SETTING_KEYS) {
        const value = settings[key];
        if (value !== undefined && isValidSetting(key, value)) {
            writeField(key, value);
        }
    }
    sent = snapshot();
    confirmed = snapshot();
};

// Only fields the user has actually stored locally, and only values the
// server would accept — a stale value is left behind rather than failing
// the whole upload.
const readLocalSettings = (): SettingsMap => {
    const settings: SettingsMap = {};
    for (const [section, { storageKey }] of Object.entries(PREFERENCE_SECTIONS)) {
        let stored: unknown;
        try {
            stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
        } catch {
            continue;
        }
        if (typeof stored !== 'object' || stored === null) continue;
        for (const [field, value] of Object.entries(stored)) {
            const key = `${section}.${field}`;
            if (isValidSetting(key, value)) {
                settings[key as SettingKey] = value as SettingValue;
            }
        }
    }
    return settings;
};

const load = async (run: number) => {
    try {
        const response = await settingsApi.get();
        if (!response.success) throw new Error(response.error);
        let { settings } = response.data;

        if (response.data.updatedAt === null) {
            // Create-only on the server: if another device signed in first
            // and already uploaded, this returns its settings unchanged.
            const migrated = await settingsApi.initialize(readLocalSettings());
            if (!migrated.success) throw new Error(migrated.error);
            settings = migrated.data.settings;
        }

        if (run !== generation) return;
        applyServerSettings(settings);
        state.status = 'ready';
    } catch (error) {
        if (run !== generation) return;
        // Leave the preferences on localStorage for this session rather
        // than showing defaults the user never chose.
        console.error('Failed to load settings:', error);
        state.status = 'error';
    }
};

// Sends every field that differs from what was last sent, skipping those
// still waiting on an earlier save; each save calls this again as it settles.
const flush = () => {
    if (state.status !== 'ready') return;

    const current = snapshot();
    const patch: SettingsMap = {};
    for (const key of SETTING_KEYS) {
        if (current[key] === sent[key] || inFlight.has(key)) continue;
        if (isValidSetting(key, current[key])) {
            patch[key] = current[key];
        } else {
            // e.g. a ToggleGroup emitting '' on deselect.
            writeField(key, sent[key]);
        }
    }
    if (Object.keys(patch).length > 0) void save(patch);
};

const save = async (patch: SettingsMap) => {
    const keys = Object.keys(patch) as SettingKey[];
    const run = generation;
    for (const key of keys) {
        sent[key] = patch[key]!;
        inFlight.add(key);
        state.saving[key] = true;
    }

    try {
        const response = await settingsApi.update(patch);
        if (!response.success) throw new Error(response.error);
        if (run !== generation) return;
        for (const key of keys) confirmed[key] = patch[key]!;
    } catch (error) {
        if (run !== generation) return;
        console.error('Failed to save settings:', error);
        // A field changed again while this was in flight keeps its newer
        // value, which flush() below sends. The rest go back.
        const reverted = keys.filter((key) => readField(key) === patch[key]);
        for (const key of keys) sent[key] = confirmed[key];
        for (const key of reverted) writeField(key, confirmed[key]);
        if (reverted.length > 0) {
            toast.error("Couldn't save your settings. The change was undone.");
        }
    } finally {
        if (run === generation) {
            for (const key of keys) {
                inFlight.delete(key);
                delete state.saving[key];
            }
            flush();
        }
    }
};

watch(snapshot, flush);

export const settingsSync = {
    start(userId: string): Promise<void> {
        if (state.userId === userId && loading && state.status !== 'error') {
            return loading;
        }
        if (state.userId !== userId) settingsSync.stop();

        state.userId = userId;
        state.status = 'loading';
        loading = load(generation);
        return loading;
    },

    /**
     * Signed in, but whose account it is couldn't be read (e.g. the access
     * token couldn't be refreshed). Shows as a load error, and retry()
     * calls `tryAgain` to read it again.
     */
    unavailable(tryAgain: () => Promise<void>) {
        settingsSync.stop();
        state.status = 'error';
        reconnect = tryAgain;
    },

    retry(): Promise<void> {
        if (state.userId) return settingsSync.start(state.userId);
        return reconnect ? reconnect() : Promise.resolve();
    },

    stop() {
        generation++;
        loading = null;
        reconnect = null;
        inFlight.clear();
        state.status = 'signed-out';
        state.userId = null;
        state.saving = {};
        applyServerSettings({});
    },
};

/**
 * One section's preferences: the caller's localStorage ref when signed out
 * (or when the server copy couldn't be loaded), the shared server-backed
 * object when signed in. Mutating a field or assigning a whole object both
 * work either way.
 */
export const useSyncedPreferences = <S extends PreferenceSection>(
    section: S,
    localPreferences: Ref<PreferenceSections[S]>,
): WritableComputedRef<PreferenceSections[S]> =>
    computed({
        get: () =>
            state.status === 'ready'
                ? (state.sections[section] as PreferenceSections[S])
                : localPreferences.value,
        set: (value) => {
            if (state.status === 'ready') {
                Object.assign(state.sections[section], value);
            } else {
                localPreferences.value = value;
            }
        },
    });

export const useSettingsSync = () => ({
    status: computed(() => state.status),
    isSaving: (key: SettingKey) => state.saving[key] === true,
    retry: settingsSync.retry,
});
