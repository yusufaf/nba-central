import { computed, shallowRef } from "vue";

export interface HistoryEntry<T> {
    id: number;
    // What undoing this entry did, for the confirmation toast.
    label: string;
    snapshot: T;
}

interface TeamHistoryOptions<T> {
    capture: () => T;
    restore: (snapshot: T) => void;
    limit?: number;
}

/**
 * Undo stack for the Team Builder. Each entry is a snapshot of the builder
 * taken just before a change, so undoing restores it wholesale rather than
 * replaying an inverse operation - adding a new undoable action is one push()
 * before the mutation, with no per-action undo logic.
 */
export const useTeamHistory = <T>({ capture, restore, limit = 50 }: TeamHistoryOptions<T>) => {
    const entries = shallowRef<HistoryEntry<T>[]>([]);
    let nextId = 1;

    const push = (label: string): number => {
        const entry = { id: nextId++, label, snapshot: capture() };
        entries.value = [...entries.value, entry].slice(-limit);
        return entry.id;
    };

    const undo = (): HistoryEntry<T> | undefined => {
        const entry = entries.value.at(-1);
        if (!entry) return undefined;
        entries.value = entries.value.slice(0, -1);
        restore(entry.snapshot);
        return entry;
    };

    const isLatest = (id: number) => entries.value.at(-1)?.id === id;

    const clear = () => {
        entries.value = [];
    };

    return {
        canUndo: computed(() => entries.value.length > 0),
        push,
        undo,
        isLatest,
        clear,
    };
};

// Everything keyed by roster slot, plus which saved team the builder is
// editing - Save updates that team in place, so it has to rewind with the
// roster.
export interface BuilderState<P = unknown> {
    players: Map<number, P>;
    cardsFlipped: Map<number, boolean>;
    comparison: Set<number>;
    loadedTeamUUID: string | null;
}

// Player objects are shared rather than cloned: they're never mutated in
// place, and keeping the same object is what brings a player's stats back
// without refetching them.
export const snapshotBuilder = <P>(state: BuilderState<P>): BuilderState<P> => ({
    players: new Map(state.players),
    cardsFlipped: new Map(state.cardsFlipped),
    comparison: new Set(state.comparison),
    loadedTeamUUID: state.loadedTeamUUID,
});

// The roster comes back exactly as it was. Flip and comparison state is only
// rewound on slots whose player the undo changes: flipping another card after
// a removal isn't part of what's being undone.
export const restoreBuilder = <P>(current: BuilderState<P>, snapshot: BuilderState<P>): BuilderState<P> => {
    const cardsFlipped = new Map(current.cardsFlipped);
    const comparison = new Set(current.comparison);
    const slots = new Set([...current.players.keys(), ...snapshot.players.keys()]);

    for (const slot of slots) {
        if (current.players.get(slot) === snapshot.players.get(slot)) continue;

        const flipped = snapshot.cardsFlipped.get(slot);
        if (flipped === undefined) cardsFlipped.delete(slot);
        else cardsFlipped.set(slot, flipped);

        comparison.delete(slot);
        // Comparison is capped at two; a pick made since wins over the old one.
        if (snapshot.comparison.has(slot) && comparison.size < 2) comparison.add(slot);
    }

    return {
        players: new Map(snapshot.players),
        cardsFlipped,
        comparison,
        loadedTeamUUID: snapshot.loadedTeamUUID,
    };
};
