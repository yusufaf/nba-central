import type { CourtDesign } from '@/models/api';
import { newCourt } from '@/utils/court';

// Teams on a built-in arena (or none) get a plain court, never an NBA replica.
export const DEFAULT_COURT: CourtDesign = { ...newCourt(''), centerLogo: 'none' };

// What to draw the court with, in order: an image on another origin can block
// the read, so each step drops one. A step that would change nothing is skipped.
export const courtAttempts = (logo?: string, drawing?: string): { logo?: string; drawing?: string }[] =>
    [
        { logo, drawing },
        { logo: undefined, drawing },
        { logo: undefined, drawing: undefined },
    ].filter(
        (attempt, i, all) => i === 0 || attempt.logo !== all[i - 1].logo || attempt.drawing !== all[i - 1].drawing,
    );
