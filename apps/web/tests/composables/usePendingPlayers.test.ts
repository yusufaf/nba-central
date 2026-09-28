import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { usePendingPlayers } from "@/composables/usePendingPlayers";
import {
    restoreBuilder,
    snapshotBuilder,
    useTeamHistory,
    type BuilderState,
} from "@/composables/useTeamHistory";

interface Player {
    id: string;
    fullName: string;
    playerStats?: { pts: number }[];
}

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
};

// The builder as TeamBuilder.vue wires it: a ref'd roster (so players come
// back out as reactive proxies, like in the app), the real snapshot/restore,
// and an add that pushes before it fills the slot.
const setup = () => {
    const players = ref(new Map<number, Player>());
    const state = (): BuilderState<Player> => ({
        players: players.value,
        cardsFlipped: new Map(),
        comparison: new Set(),
        details: {
            name: "",
            description: "",
            city: "",
            country: "",
            logo: "",
            jersey: "",
            coach: null,
            arena: null,
            gm: null,
        },
        loadedTeam: { uuid: null, isPublic: false, cardUrl: null, owner: "" },
    });
    const history = useTeamHistory<BuilderState<Player>>({
        capture: () => snapshotBuilder(state()),
        restore: (snapshot) => {
            players.value = restoreBuilder(state(), snapshot).players;
        },
    });
    const pending = usePendingPlayers<Player>();

    const add = (slot: number, player: Player) => {
        const stats = deferred<Partial<Player>>();
        history.push({ undoLabel: "", redoLabel: "" });
        const loading = pending.load(player, () => stats.promise);
        players.value.set(slot, loading.player);
        return { ...loading, land: async (pts: number) => {
            stats.resolve({ playerStats: [{ pts }] });
            await loading.done;
        } };
    };

    return { players, history, pending, add };
};

const curry: Player = { id: "curryst01", fullName: "Stephen Curry" };
const kobe: Player = { id: "bryanko01", fullName: "Kobe Bryant" };

describe("usePendingPlayers", () => {
    it("fills the player in place once their stats land", async () => {
        const { players, pending, add } = setup();

        const { land } = add(1, curry);
        expect(pending.isPending(players.value.get(1))).toBe(true);
        expect(players.value.get(1)?.playerStats).toBeUndefined();

        await land(30);

        expect(pending.isPending(players.value.get(1))).toBe(false);
        expect(players.value.get(1)?.playerStats).toEqual([{ pts: 30 }]);
    });

    it("never touches the object it was given", async () => {
        const { add } = setup();
        const { land } = add(1, curry);
        await land(30);
        expect(curry).toEqual({ id: "curryst01", fullName: "Stephen Curry" });
    });

    it("stops being pending even if the fetch fails", async () => {
        const { pending } = setup();
        const loading = pending.load(curry, () => Promise.reject(new Error("offline")));

        await expect(loading.done).rejects.toThrow("offline");
        expect(pending.isPending(loading.player)).toBe(false);
    });

    describe("the in-flight add race", () => {
        it("an add undone before its stats land leaves the slot empty after they do", async () => {
            const { players, history, pending, add } = setup();

            const { land } = add(1, curry);
            history.undo();
            await land(30);

            expect(players.value.has(1)).toBe(false);
            // Nothing left spinning: the card for slot 1 is plain empty.
            expect([...players.value.values()].some((p) => pending.isPending(p))).toBe(false);
        });

        it("redo brings the undone add back with the stats that landed meanwhile", async () => {
            const { players, history, pending, add } = setup();

            const { land } = add(1, curry);
            history.undo();
            await land(30);
            history.redo();

            expect(players.value.get(1)?.playerStats).toEqual([{ pts: 30 }]);
            expect(pending.isPending(players.value.get(1))).toBe(false);
        });

        it("redo before the stats land shows the player loading, then filled", async () => {
            const { players, history, pending, add } = setup();

            const { land } = add(1, curry);
            history.undo();
            history.redo();
            expect(pending.isPending(players.value.get(1))).toBe(true);

            await land(30);
            expect(players.value.get(1)?.playerStats).toEqual([{ pts: 30 }]);
        });

        it("a slot removed or cleared mid-flight stays empty", async () => {
            const { players, add } = setup();

            const first = add(1, curry);
            const second = add(2, kobe);
            players.value.delete(1);
            players.value.clear();
            await first.land(30);
            await second.land(25);

            expect(players.value.size).toBe(0);
        });

        // A snapshot taken while an earlier add is still loading has that
        // player in it, so undoing a later change can't wipe it out once it
        // has landed.
        it("undoing a later change keeps an earlier add that landed in between", async () => {
            const { players, history, add } = setup();

            const first = add(1, curry);
            const second = add(2, kobe);
            await first.land(30);
            history.undo();

            expect(players.value.get(1)?.playerStats).toEqual([{ pts: 30 }]);
            expect(players.value.has(2)).toBe(false);
            await second.land(25);
            expect(players.value.has(2)).toBe(false);
        });

        it("undoing a later change doesn't cancel an earlier add still loading", async () => {
            const { players, history, add } = setup();

            const first = add(1, curry);
            add(2, kobe);
            history.undo();
            await first.land(30);

            expect(players.value.get(1)?.playerStats).toEqual([{ pts: 30 }]);
        });
    });
});
