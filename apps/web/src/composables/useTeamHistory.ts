import { computed, shallowRef } from "vue";

export interface HistoryAction {
    // Toast text for undoing and redoing this change, e.g. "Restored X to PG"
    // and "Removed X from PG".
    undoLabel: string;
    redoLabel: string;
    // Consecutive pushes with the same key fold into one entry that keeps the
    // first push's snapshot, so a burst of typing undoes as one step. Only
    // while nothing else has been pushed, undone or redone in between; the
    // caller changes the key to force a new entry (per focus, say).
    mergeKey?: string;
}

export interface HistoryEntry<T> extends HistoryAction {
    id: number;
    snapshot: T;
}

interface TeamHistoryOptions<T> {
    capture: () => T;
    restore: (snapshot: T, action: HistoryAction) => void;
    limit?: number;
}

/**
 * Undo/redo for the Team Builder. Each undo entry is a snapshot of the
 * builder taken just before a change, so undoing restores it wholesale rather
 * than replaying an inverse operation - adding a new undoable action is one
 * push() before the mutation, with no per-action undo logic. Undoing captures
 * the state it is leaving as the redo entry, and redoing does the reverse;
 * any new push drops the redo stack.
 */
export const useTeamHistory = <T>({ capture, restore, limit = 50 }: TeamHistoryOptions<T>) => {
    const undoStack = shallowRef<HistoryEntry<T>[]>([]);
    const redoStack = shallowRef<HistoryEntry<T>[]>([]);
    let nextId = 1;
    // The entry push() may fold into - cleared by anything that moves
    // between the stacks, since the top entry is then an older change.
    let mergeableId: number | undefined;

    // The entry a push with this key would fold into, if any.
    const mergeTarget = (mergeKey: string): HistoryEntry<T> | undefined => {
        const top = undoStack.value.at(-1);
        return top && top.id === mergeableId && top.mergeKey === mergeKey ? top : undefined;
    };

    const push = (action: HistoryAction): number => {
        redoStack.value = [];
        const top = action.mergeKey === undefined ? undefined : mergeTarget(action.mergeKey);
        if (top) {
            undoStack.value = [...undoStack.value.slice(0, -1), { ...top, ...action }];
            return top.id;
        }
        const entry = { ...action, id: nextId++, snapshot: capture() };
        undoStack.value = [...undoStack.value, entry].slice(-limit);
        mergeableId = entry.id;
        return entry.id;
    };

    // Takes the top of `from`, files the current state under the same entry
    // on `to`, and restores the snapshot it held.
    const step = (from: typeof undoStack, to: typeof undoStack): HistoryEntry<T> | undefined => {
        const entry = from.value.at(-1);
        if (!entry) return undefined;
        mergeableId = undefined;
        from.value = from.value.slice(0, -1);
        to.value = [...to.value, { ...entry, snapshot: capture() }].slice(-limit);
        restore(entry.snapshot, entry);
        return entry;
    };

    const undo = () => step(undoStack, redoStack);
    const redo = () => step(redoStack, undoStack);

    const isLatest = (id: number) => undoStack.value.at(-1)?.id === id;

    const clear = () => {
        undoStack.value = [];
        redoStack.value = [];
        mergeableId = undefined;
    };

    return {
        canUndo: computed(() => undoStack.value.length > 0),
        canRedo: computed(() => redoStack.value.length > 0),
        push,
        mergeTarget,
        undo,
        redo,
        isLatest,
        clear,
    };
};

export interface TeamDetails {
    name: string;
    description: string;
    city: string;
    country: string;
    logo: string;
    jersey: string;
    coach: unknown;
    arena: unknown;
    gm: unknown;
}

// Which saved team the builder is editing - Save updates that team in place,
// so it has to rewind with the roster - and what the server holds for it.
export interface LoadedTeam {
    uuid: string | null;
    isPublic: boolean;
    cardUrl: string | null;
    owner: string;
}

export interface BuilderState<P = unknown> {
    players: Map<number, P>;
    cardsFlipped: Map<number, boolean>;
    comparison: Set<number>;
    details: TeamDetails;
    loadedTeam: LoadedTeam;
}

// Player objects are shared rather than cloned: nothing but the stats load
// that created one ever writes to it (usePendingPlayers), and keeping the
// same object is what brings a player's stats back without refetching them.
// Coach, arena and GM are replaced rather than edited, so the same goes for
// them.
export const snapshotBuilder = <P>(state: BuilderState<P>): BuilderState<P> => ({
    players: new Map(state.players),
    cardsFlipped: new Map(state.cardsFlipped),
    comparison: new Set(state.comparison),
    details: { ...state.details },
    loadedTeam: { ...state.loadedTeam },
});

// The roster and team details come back exactly as they were - every edit to
// either is an entry of its own, so nothing made since is lost. Flip and
// comparison state is only rewound on slots whose player the undo changes:
// flipping another card after a removal isn't part of what's being undone.
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
    }
    // Added once every slot has been cleared, so a pick moving between two
    // slots (undoing a swap) isn't mistaken for a second pick. A second pick
    // is what opens the comparison, and the pair is only cleared when that
    // closes - so a restore that completed a pair would leave two picks with
    // no comparison and block further picks. A pick made since wins.
    for (const slot of slots) {
        if (current.players.get(slot) === snapshot.players.get(slot)) continue;
        if (snapshot.comparison.has(slot) && comparison.size === 0) comparison.add(slot);
    }

    return {
        players: new Map(snapshot.players),
        cardsFlipped,
        comparison,
        details: { ...snapshot.details },
        // isPublic, cardUrl and owner are the server's record of the loaded
        // team, not builder edits - publishing isn't undoable, so they only
        // rewind when the team itself does (undoing Clear Team).
        loadedTeam:
            current.loadedTeam.uuid === snapshot.loadedTeam.uuid ? current.loadedTeam : { ...snapshot.loadedTeam },
    };
};
