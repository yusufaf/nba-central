import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Scene3DLoading from '@/components/scene3d/Scene3DLoading.vue';
import { DEFAULT_VIEWPORT_CLASS } from '@/components/scene3d/viewport';
import { CAMERA_PRESETS, PRESET_LABELS } from '@/constants/cameraPresets';

const BANNER = { kind: 'title', title: 'CHAMPIONS', subtitle: '1998', color: '#1d2a44' } as const;
const labels = (w: ReturnType<typeof mount>) => w.findAll('[data-testid="scene3d-loading-row"] button').map((b) => b.text());

// The space the 3D scene takes while its chunk downloads (#300).
describe('Scene3DLoading', () => {
    it("holds the scene's viewport height", () => {
        expect(mount(Scene3DLoading).find('[role="status"]').classes()).toContain(DEFAULT_VIEWPORT_CLASS);
        const editor = mount(Scene3DLoading, { props: { viewportClass: 'h-[min(32dvh,15rem)]' } });
        expect(editor.find('[role="status"]').classes()).toContain('h-[min(32dvh,15rem)]');
    });

    it('holds a row of the offered camera pills', () => {
        const w = mount(Scene3DLoading);
        expect(labels(w)).toEqual(CAMERA_PRESETS.filter((preset) => preset !== 'banners').map((preset) => PRESET_LABELS[preset]));
        const row = w.find('[data-testid="scene3d-loading-row"]');
        expect(row.classes()).toContain('invisible');
        expect(row.attributes('aria-hidden')).toBe('true');
        for (const button of row.findAll('button')) expect(button.attributes('tabindex')).toBe('-1');
        expect(labels(mount(Scene3DLoading, { props: { presets: ['team', 'courtside', 'banners'] } }))).toEqual([
            'Team photo',
            'Courtside',
        ]);
    });

    it('includes Banners only when the venue has banners', () => {
        const withBanners = mount(Scene3DLoading, { props: { venue: { version: 1, banners: [BANNER] } } });
        expect(labels(withBanners)).toEqual(CAMERA_PRESETS.map((preset) => PRESET_LABELS[preset]));
        const malformed = mount(Scene3DLoading, { props: { venue: { version: 1, banners: [{ ...BANNER, color: 'gold' }] } } });
        expect(labels(malformed)).not.toContain('Banners');
    });

    it("ignores the scene's other props", () => {
        const w = mount(Scene3DLoading, { attrs: { court: 'x', label: 'Owls court', capacity: 18000 } });
        expect(w.find('[data-testid="scene3d-loading"]').attributes('court')).toBeUndefined();
        expect(w.find('[data-testid="scene3d-loading"]').attributes('label')).toBeUndefined();
    });
});
