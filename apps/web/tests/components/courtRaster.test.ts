import { describe, expect, it } from 'vitest';
import { DEFAULT_COURT, courtAttempts } from '@/components/scene3d/courtRaster';

describe('courtAttempts', () => {
    it('drops the logo, then the drawing, when both are set', () => {
        expect(courtAttempts('logo.png', 'drawing.png')).toEqual([
            { logo: 'logo.png', drawing: 'drawing.png' },
            { logo: undefined, drawing: 'drawing.png' },
            { logo: undefined, drawing: undefined },
        ]);
    });

    it('skips a step that would change nothing', () => {
        expect(courtAttempts('logo.png', undefined)).toEqual([
            { logo: 'logo.png', drawing: undefined },
            { logo: undefined, drawing: undefined },
        ]);
        expect(courtAttempts(undefined, 'drawing.png')).toEqual([
            { logo: undefined, drawing: 'drawing.png' },
            { logo: undefined, drawing: undefined },
        ]);
    });

    it('tries once with no images', () => {
        expect(courtAttempts(undefined, undefined)).toEqual([{ logo: undefined, drawing: undefined }]);
    });
});

describe('DEFAULT_COURT', () => {
    it('has no centre logo', () => {
        expect(DEFAULT_COURT.centerLogo).toBe('none');
    });
});
