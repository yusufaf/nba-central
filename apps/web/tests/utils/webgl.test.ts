import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebGLAvailable } from '@/utils/webgl';

describe('isWebGLAvailable', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns false when getContext returns null', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        expect(isWebGLAvailable()).toBe(false);
    });

    it('returns true when webgl2 is available', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
            kind === 'webgl2' ? ({} as RenderingContext) : null) as typeof HTMLCanvasElement.prototype.getContext);
        expect(isWebGLAvailable()).toBe(true);
    });
});
