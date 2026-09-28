import { reactive, shallowReactive, toRaw } from "vue";

/**
 * Players whose career stats are still being fetched.
 *
 * An add puts the player in its slot straight away and the stats are filled
 * in on that same object when they arrive; the response never writes a slot.
 * Where the player is by then is up to whatever happened meanwhile - an undo,
 * a removal, Clear Team, another team loading - so a late response can't
 * land in a slot the user has since emptied. Undo snapshots share the object
 * too: one taken mid-load already holds the player, and a redo of an add
 * undone mid-load brings it back with the stats that arrived since.
 */
export const usePendingPlayers = <P extends object>() => {
    const pending = shallowReactive(new Set<P>());

    const isPending = (player: P | undefined) => player !== undefined && pending.has(toRaw(player));

    const load = (player: P, fetchDetails: () => Promise<Partial<P>>) => {
        const loading = reactive({ ...player }) as P;
        const raw = toRaw(loading);
        pending.add(raw);
        const done = fetchDetails()
            .then((details) => {
                Object.assign(loading, details);
            })
            .finally(() => pending.delete(raw));
        return { player: loading, done };
    };

    return { isPending, load };
};
