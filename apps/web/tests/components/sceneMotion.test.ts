import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, type EffectScope } from 'vue';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));

import { settingsSync } from '@/composables/useSettingsSync';
import { useDisplayPreferences } from '@/composables/useDisplayPreferences';
import { COARSE_POINTER, useSceneMotion } from '@/components/scene3d/sceneMotion';

// jsdom has no matchMedia: this stands in for the OS reduced-motion setting
// and the primary pointer, either of which can change while the page is open.
let osReducesMotion = false;
let osCoarse = false;
const queries: (EventTarget & { matches: boolean; media: string })[] = [];
const osMatches = (media: string) =>
    (media.includes('reduce') && osReducesMotion) || (media.includes('pointer: coarse') && osCoarse);
const notify = () => {
    for (const query of queries) {
        const matches = osMatches(query.media);
        if (query.matches === matches) continue;
        query.matches = matches;
        query.dispatchEvent(Object.assign(new Event('change'), { matches }));
    }
};

let scope: EffectScope;
const motion = () => scope.run(() => useSceneMotion())!;
const setting = (value: 'system' | 'reduce' | 'allow') => {
    useDisplayPreferences().preferences.value.reducedMotion = value;
};

beforeEach(() => {
    settingsSync.stop();
    localStorage.clear();
    osReducesMotion = false;
    osCoarse = false;
    queries.length = 0;
    window.matchMedia = vi.fn((media: string) => {
        const query = Object.assign(new EventTarget(), { media, matches: osMatches(media) });
        queries.push(query);
        return query as unknown as MediaQueryList;
    });
    scope = effectScope();
    setting('system');
});

afterEach(() => scope.stop());

describe('useSceneMotion', () => {
    it('is on with a fine pointer and no preference', () => {
        expect(motion().value).toBe(true);
    });

    it('is off on a touch screen', () => {
        osCoarse = true;
        expect(motion().value).toBe(false);
    });

    it('is off when the OS reduces motion', () => {
        osReducesMotion = true;
        expect(motion().value).toBe(false);
    });

    it('is off when the setting is Reduce', async () => {
        setting('reduce');
        await nextTick();
        expect(motion().value).toBe(false);
    });

    it('stays off on a touch screen even when the setting is Allow', async () => {
        setting('allow');
        osCoarse = true;
        await nextTick();
        expect(motion().value).toBe(false);
    });

    it('lets Allow override the OS on a fine pointer', async () => {
        setting('allow');
        osReducesMotion = true;
        await nextTick();
        expect(motion().value).toBe(true);
    });

    it('follows the pointer as it changes', async () => {
        const on = motion();
        expect(on.value).toBe(true);
        osCoarse = true;
        notify();
        await nextTick();
        expect(on.value).toBe(false);
        osCoarse = false;
        notify();
        await nextTick();
        expect(on.value).toBe(true);
    });

    it("asks the query the Playwright touch test stubs", () => {
        expect(COARSE_POINTER).toBe('(pointer: coarse)');
    });
});
