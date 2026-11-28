import type { SaveTeamPayload } from '@/models/api';

// Every saved player is a snapshot with a fullName, built-in or custom.
const isRosterEntry = (entry: unknown): boolean => {
    if (typeof entry !== 'object' || entry === null) return false;
    const { slot, player } = entry as { slot?: unknown; player?: { fullName?: unknown } | null };
    return (
        Number.isInteger(slot) &&
        (slot as number) >= 0 &&
        typeof player === 'object' &&
        player !== null &&
        typeof player.fullName === 'string'
    );
};

/**
 * Whether a team read back from browser storage can be put into the
 * builder: a title, and a roster of player snapshots in distinct slots.
 */
export const isSaveTeamPayload = (team: unknown): team is SaveTeamPayload => {
    if (typeof team !== 'object' || team === null) return false;
    const { title, roster } = team as { title?: unknown; roster?: unknown };
    if (typeof title !== 'string' || !Array.isArray(roster)) return false;
    if (!roster.every(isRosterEntry)) return false;
    const slots = roster.map((entry: { slot: number }) => entry.slot);
    return new Set(slots).size === slots.length;
};
