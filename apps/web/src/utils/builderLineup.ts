import type { RouteLocationRaw } from "vue-router";
import { NBA_POSITIONS, playsPosition } from "@/constants/positions";

/** The starting five: `?players=` fills no bench slot. */
export const LINEUP_SIZE = 5;

/**
 * `?players=a,b,c` -> ["a", "b", "c"]: trimmed, blanks and repeats dropped,
 * at most five. A repeated `?players=` (an array) or no param reads as no one.
 */
export const parsePlayersParam = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    const ids = value.split(",").map((id) => id.trim()).filter(Boolean);
    return [...new Set(ids)].slice(0, LINEUP_SIZE);
};

/** The builder link that opens a new team starting these players. */
export const lineupBuilderLink = (ids: readonly string[]): RouteLocationRaw => ({
    path: "/teambuilder",
    query: { players: ids.join(",") },
});

export interface PositionedPlayer {
    id: string;
    position?: string;
    positions?: string[];
}

const permutations = (items: number[]): number[][] =>
    items.length <= 1
        ? [items]
        : items.flatMap((first, i) =>
              permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [first, ...rest]),
          );

// Lexicographic, identity first; 120 of them.
const SLOT_ORDERS = permutations([...NBA_POSITIONS.keys()]);

/**
 * Up to five players into slots 1-5 (PG, SG, SF, PF, C): as many players as
 * possible at a position they play; when picks compete for a position, the
 * earlier pick gets it. Among equally good placements, earlier picks take the
 * earlier slots (PG first), even out of position.
 */
export const starterSlots = <T extends PositionedPlayer>(players: readonly T[]): Map<number, T> => {
    const lineup = players.slice(0, LINEUP_SIZE);
    // Each pick outweighs every later pick together, so the best score seats
    // earlier picks in position first, and never fewer players in position.
    const score = (order: number[]) =>
        lineup.reduce(
            (sum, player, i) =>
                playsPosition(player, NBA_POSITIONS[order[i]]) ? sum + (1 << (LINEUP_SIZE - 1 - i)) : sum,
            0,
        );
    let best = SLOT_ORDERS[0];
    let bestScore = score(best);
    for (const order of SLOT_ORDERS) {
        const s = score(order);
        if (s > bestScore) [best, bestScore] = [order, s];
    }
    return new Map(lineup.map((player, i) => [best[i] + 1, player]));
};
