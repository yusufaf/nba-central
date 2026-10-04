import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useImageChoice } from '@/composables/useImageChoice';

const png = () => new File(['x'], 'logo.png', { type: 'image/png' });

beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:new');
    globalThis.URL.revokeObjectURL = vi.fn();
});

describe('useImageChoice', () => {
    it('hands back the prepared image and previews it', async () => {
        const prepared = new Blob(['png'], { type: 'image/png' });
        const image = useImageChoice(async () => prepared, 'nope');
        await image.choose(png());
        expect(image.change.value).toBe(prepared);
        expect(image.shown('https://cdn.example/saved.png')).toBe('blob:new');
    });

    it('lets Remove win over a resize that is still running', async () => {
        let finish: (blob: Blob) => void = () => {};
        const image = useImageChoice(() => new Promise<Blob>((resolve) => (finish = resolve)), 'nope');

        void image.choose(png());
        expect(image.preparing.value).toBe(true);
        image.remove(true);
        finish(new Blob(['late'], { type: 'image/png' }));
        await flushPromises();

        expect(image.change.value).toBeNull();
        expect(image.preparing.value).toBe(false);
        expect(image.shown('https://cdn.example/saved.png')).toBeNull();
    });
});
