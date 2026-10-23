import type { CapFiveCandidate, CapFivePuzzleView, CapFiveResult } from '@/models/api';

const RATED: [string, string, number, CapFiveCandidate['ratingSource']][] = [
    ['c01', 'Ray Allen', 88, 'all-time'],
    ['c02', 'Mookie Blaylock', 78, 'classic-peak'],
    ['c03', 'Vince Carter', 85, 'all-time'],
    ['c04', 'Stephen Curry', 95, 'current'],
    ['c05', 'Tim Duncan', 91, 'all-time'],
    ['c06', 'Derek Fisher', 68, 'classic-peak'],
    ['c07', 'Grant Hill', 83, 'all-time'],
    ['c08', 'Kyle Korver', 73, 'classic-peak'],
    ['c09', 'Kyle Lowry', 76, 'current'],
    ['c10', 'Dikembe Mutombo', 81, 'all-time'],
    ['c11', 'Jalen Suggs', 71, 'current'],
    ['c12', 'Jason Terry', 66, 'classic-peak'],
];

export const candidates: CapFiveCandidate[] = RATED.map(([id, name, rating, ratingSource]) => ({
    id,
    name,
    positions: ['SF'],
    rating,
    ratingSource,
}));

export const puzzleView: CapFivePuzzleView = {
    puzzleNumber: 12,
    date: '2026-11-02',
    cap: 415,
    gameVersion: '2K27',
    candidates: candidates.map(({ id, name, positions, ratingSource }) => ({
        id,
        name,
        positions,
        era: ratingSource === 'current' ? 'current' : 'legend',
    })),
};

// Curry 95, Allen 88, Hill 83, Blaylock 78, Fisher 68: 412 of a perfect 415.
export const picks = ['c04', 'c01', 'c07', 'c02', 'c06'];

export const result = (over: Partial<CapFiveResult> = {}): CapFiveResult => ({
    puzzleNumber: 12,
    date: '2026-11-02',
    cap: 415,
    gameVersion: '2K27',
    picks,
    total: 412,
    busted: false,
    // Curry 95, Allen 88, Carter 85, Mutombo 81, Terry 66.
    optimal: { total: 415, lineup: ['c04', 'c01', 'c03', 'c10', 'c12'], count: 3 },
    candidates,
    ...over,
});
