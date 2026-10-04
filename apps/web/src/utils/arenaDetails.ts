import arenaData from '@/assets/data/arenas.json';
import type { Arena } from '@/models/types';
import type { ResolvedArena } from '@/models/api';

const builtInArenas = arenaData as Arena[];

// arenas.json keeps capacity as Wikipedia prints it ("19,200"); saved teams
// and custom arenas keep a number.
export const parseCapacity = (capacity: string | number | null | undefined): number | undefined => {
    const value = typeof capacity === 'string' ? Number(capacity.replaceAll(',', '')) : capacity;
    return typeof value === 'number' && Number.isFinite(value) && capacity !== '' ? value : undefined;
};

// Fixed to en-US so a built-in arena reads the same as its arenas.json row.
const capacityFormat = new Intl.NumberFormat('en-US');

export const formatCapacity = (capacity: number) => capacityFormat.format(capacity);

/** "Seattle, Washington · 18,600 · opened 2026", leaving out what's missing. */
export const arenaDetails = (arena: {
    location?: string | null;
    capacity?: string | number | null;
    openedYear?: number | null;
}): string => {
    const capacity = parseCapacity(arena.capacity);
    return [
        arena.location,
        capacity !== undefined ? formatCapacity(capacity) : null,
        arena.openedYear ? `opened ${arena.openedYear}` : null,
    ]
        .filter(Boolean)
        .join(' · ');
};

/**
 * Teams saved before arenas kept their details hold only `{ name, imgLink }`.
 * Those are filled from arenas.json by exact name, and the next save writes
 * the details back. Stored values win; custom arenas are left alone.
 */
export const backfillArena = <T extends ResolvedArena>(arena: T | null): T | null => {
    if (!arena || arena.isCustom) return arena;
    const match = builtInArenas.find((row) => row.name === arena.name);
    if (!match) return arena;
    return {
        ...arena,
        imgLink: arena.imgLink ?? match.imgLink,
        location: arena.location ?? match.location,
        capacity: arena.capacity ?? parseCapacity(match.capacity),
        openedYear: arena.openedYear ?? match.openedYear,
    };
};
