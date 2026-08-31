import type { RatingSource } from '@/models/types';

export type RatingTier = 'elite' | 'great' | 'good' | 'average';

/**
 * Bands follow how NBA 2K itself talks about ratings: 90+ is a superstar,
 * 80s a starter, 70s a rotation player, below that a bench body.
 */
export const ratingTier = (rating: number): RatingTier => {
    if (rating >= 90) return 'elite';
    if (rating >= 80) return 'great';
    if (rating >= 70) return 'good';
    return 'average';
};

/**
 * Only a fraction of the player pool is rated in 2K, and retired players are
 * rated as their All-Time or peak Classic selves rather than for a season.
 * The label keeps that distinction visible instead of implying every number
 * means the same thing.
 */
export const ratingSourceLabel = (source?: RatingSource): string => {
    switch (source) {
        case 'current':
            return 'Current NBA 2K rating';
        case 'all-time':
            return 'All-Time team rating';
        case 'classic-peak':
            return 'Peak Classic-team rating';
        default:
            return 'Custom player rating';
    }
};

/** Average of the rated players only - unrated players are skipped, not zeroed. */
export const averageRating = (
    ratings: (number | undefined)[],
): number | null => {
    const rated = ratings.filter(
        (r): r is number => typeof r === 'number' && Number.isFinite(r),
    );
    if (!rated.length) return null;
    return Math.round(rated.reduce((sum, r) => sum + r, 0) / rated.length);
};
