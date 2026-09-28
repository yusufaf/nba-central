import { describe, it, expect } from "vitest";
import {
    restoreBuilder,
    snapshotBuilder,
    useTeamHistory,
    type BuilderState,
    type HistoryAction,
} from "@/composables/useTeamHistory";

// A stand-in for the builder: history only cares that capture/restore round-trip.
const setup = (limit?: number) => {
    const state = { roster: ["Duckworth", "Lawson"] };
    const restoredWith: HistoryAction[] = [];
    const history = useTeamHistory({
        capture: () => [...state.roster],
        restore: (snapshot, action) => {
            state.roster = [...snapshot];
            restoredWith.push(action);
        },
        limit,
    });
    return { state, restoredWith, ...history };
};

const action = (name: string, extra: Partial<HistoryAction> = {}): HistoryAction => ({
    undoLabel: `Undid ${name}`,
    redoLabel: `Redid ${name}`,
    ...extra,
});

describe("useTeamHistory", () => {
    it("starts empty", () => {
        const { canUndo, canRedo } = setup();
        expect(canUndo.value).toBe(false);
        expect(canRedo.value).toBe(false);
    });

    it("restores the state captured by push", () => {
        const { state, push, undo, canUndo } = setup();

        push(action("remove Lawson"));
        state.roster = ["Duckworth"];
        expect(canUndo.value).toBe(true);

        const entry = undo();
        expect(entry?.undoLabel).toBe("Undid remove Lawson");
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
        expect(canUndo.value).toBe(false);
    });

    it("hands restore the action being undone", () => {
        const { state, push, undo, restoredWith } = setup();

        push(action("clear", { includesDetails: true }));
        state.roster = [];
        undo();

        expect(restoredWith).toEqual([expect.objectContaining({ includesDetails: true })]);
    });

    it("does nothing when undoing an empty stack", () => {
        const { state, undo } = setup();

        expect(undo()).toBeUndefined();
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
    });

    it("undoes several changes in reverse order", () => {
        const { state, push, undo } = setup();

        push(action("remove Lawson"));
        state.roster = ["Duckworth"];
        push(action("remove Duckworth"));
        state.roster = [];

        expect(undo()?.undoLabel).toBe("Undid remove Duckworth");
        expect(state.roster).toEqual(["Duckworth"]);
        expect(undo()?.undoLabel).toBe("Undid remove Lawson");
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
        expect(undo()).toBeUndefined();
    });

    it("captures at push time, not at undo time", () => {
        const { state, push, undo } = setup();

        push(action("remove Lawson"));
        state.roster.pop();
        undo();
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
    });

    it("tells whether an entry is still the next one to undo", () => {
        const { state, push, undo, isLatest } = setup();

        const first = push(action("remove Lawson"));
        state.roster = ["Duckworth"];
        const second = push(action("remove Duckworth"));
        expect(isLatest(first)).toBe(false);
        expect(isLatest(second)).toBe(true);

        undo();
        expect(isLatest(second)).toBe(false);
        expect(isLatest(first)).toBe(true);
    });

    it("forgets everything on clear, including redo", () => {
        const { state, push, undo, redo, clear, canUndo, canRedo } = setup();

        push(action("remove Lawson"));
        state.roster = ["Duckworth"];
        push(action("remove Duckworth"));
        state.roster = [];
        undo();
        clear();

        expect(canUndo.value).toBe(false);
        expect(canRedo.value).toBe(false);
        expect(undo()).toBeUndefined();
        expect(redo()).toBeUndefined();
        expect(state.roster).toEqual(["Duckworth"]);
    });

    it("drops the oldest entries past the limit", () => {
        const { state, push, undo } = setup(2);

        push(action("one"));
        state.roster = ["Duckworth"];
        push(action("two"));
        state.roster = [];
        push(action("three"));
        state.roster = ["Lawson"];

        expect(undo()?.undoLabel).toBe("Undid three");
        expect(undo()?.undoLabel).toBe("Undid two");
        expect(undo()).toBeUndefined();
    });

    describe("redo", () => {
        it("puts back what undo took away", () => {
            const { state, push, undo, redo, canRedo, canUndo } = setup();

            push(action("remove Lawson"));
            state.roster = ["Duckworth"];
            undo();
            expect(canRedo.value).toBe(true);

            const entry = redo();
            expect(entry?.redoLabel).toBe("Redid remove Lawson");
            expect(state.roster).toEqual(["Duckworth"]);
            expect(canRedo.value).toBe(false);
            expect(canUndo.value).toBe(true);
        });

        it("does nothing with nothing undone", () => {
            const { state, push, redo } = setup();

            push(action("remove Lawson"));
            state.roster = ["Duckworth"];

            expect(redo()).toBeUndefined();
            expect(state.roster).toEqual(["Duckworth"]);
        });

        it("walks forward through several undos in order", () => {
            const { state, push, undo, redo } = setup();

            push(action("remove Lawson"));
            state.roster = ["Duckworth"];
            push(action("remove Duckworth"));
            state.roster = [];
            push(action("add Olajuwon"));
            state.roster = ["Olajuwon"];

            undo();
            undo();
            undo();
            expect(state.roster).toEqual(["Duckworth", "Lawson"]);

            expect(redo()?.redoLabel).toBe("Redid remove Lawson");
            expect(state.roster).toEqual(["Duckworth"]);
            expect(redo()?.redoLabel).toBe("Redid remove Duckworth");
            expect(state.roster).toEqual([]);
            expect(redo()?.redoLabel).toBe("Redid add Olajuwon");
            expect(state.roster).toEqual(["Olajuwon"]);
            expect(redo()).toBeUndefined();
        });

        it("can undo a redone entry again", () => {
            const { state, push, undo, redo } = setup();

            push(action("remove Lawson"));
            state.roster = ["Duckworth"];
            undo();
            redo();
            undo();

            expect(state.roster).toEqual(["Duckworth", "Lawson"]);
        });

        it("keeps the entry's id, so its toast's Undo still matches after a redo", () => {
            const { state, push, undo, redo, isLatest } = setup();

            const id = push(action("remove Lawson"));
            state.roster = ["Duckworth"];
            undo();
            redo();

            expect(isLatest(id)).toBe(true);
        });

        it("is invalidated by any new push", () => {
            const { state, push, undo, redo, canRedo } = setup();

            push(action("remove Lawson"));
            state.roster = ["Duckworth"];
            push(action("remove Duckworth"));
            state.roster = [];
            undo();
            undo();
            push(action("add Olajuwon"));
            state.roster = ["Duckworth", "Lawson", "Olajuwon"];

            expect(canRedo.value).toBe(false);
            expect(redo()).toBeUndefined();
            expect(state.roster).toEqual(["Duckworth", "Lawson", "Olajuwon"]);
        });

        it("hands restore the action being redone", () => {
            const { state, push, undo, redo, restoredWith } = setup();

            push(action("clear", { includesDetails: true }));
            state.roster = [];
            undo();
            redo();

            expect(restoredWith).toHaveLength(2);
            expect(restoredWith[1]).toMatchObject({ redoLabel: "Redid clear", includesDetails: true });
        });
    });

    // For text edits (#113): one entry per burst of typing, not per keystroke.
    describe("mergeKey", () => {
        it("folds consecutive pushes with the same key into the first entry", () => {
            const { state, push, undo, canUndo } = setup();

            const first = push(action("rename", { mergeKey: "name" }));
            state.roster = ["D"];
            const second = push(action("rename again", { mergeKey: "name" }));
            state.roster = ["Du"];

            expect(second).toBe(first);
            expect(undo()?.undoLabel).toBe("Undid rename again");
            expect(state.roster).toEqual(["Duckworth", "Lawson"]);
            expect(canUndo.value).toBe(false);
        });

        it("starts a new entry once something else was pushed in between", () => {
            const { state, push, undo } = setup();

            push(action("rename", { mergeKey: "name" }));
            state.roster = ["D"];
            push(action("remove"));
            state.roster = [];
            push(action("rename", { mergeKey: "name" }));
            state.roster = ["X"];

            undo();
            expect(state.roster).toEqual([]);
        });

        it("starts a new entry after an undo, even if the key matches what's on top", () => {
            const { state, push, undo } = setup();

            push(action("rename", { mergeKey: "name" }));
            state.roster = ["D"];
            push(action("remove"));
            state.roster = [];
            undo();
            push(action("rename", { mergeKey: "name" }));
            state.roster = ["Dx"];

            undo();
            expect(state.roster).toEqual(["D"]);
        });

        it("never merges different keys", () => {
            const { state, push, undo } = setup();

            push(action("rename", { mergeKey: "name" }));
            state.roster = ["D"];
            push(action("city", { mergeKey: "city" }));
            state.roster = ["DC"];

            undo();
            expect(state.roster).toEqual(["D"]);
        });
    });
});

const duckworth = { id: "duckwo01", fullName: "Duckworth", playerStats: [{ pts: 12 }] };
const lawson = { id: "lawsoa01", fullName: "Lawson", playerStats: [{ pts: 9 }] };
const olajuwon = { id: "olajuha01", fullName: "Olajuwon", playerStats: [{ pts: 21 }] };

const builder = (): BuilderState<object> => ({
    players: new Map<number, object>([
        [1, duckworth],
        [6, lawson],
        [7, olajuwon],
    ]),
    cardsFlipped: new Map([
        [1, false],
        [6, true],
        [7, false],
    ]),
    comparison: new Set([6]),
    details: {
        name: "Rip City",
        description: "Custom NBA Team",
        city: "Portland",
        country: "US",
        logo: "https://cdn/logo.png",
        jersey: "https://cdn/jersey.png",
        coach: { name: "Chauncey Billups" },
        arena: { name: "Moda Center" },
        gm: { name: "Joe Cronin" },
    },
    loadedTeam: { uuid: "team-a", isPublic: true, cardUrl: "https://cdn/card.png", owner: "yusuf" },
});

// What Clear Team leaves behind (TeamBuilder's wipeBuilder).
const cleared = (): BuilderState<object> => ({
    players: new Map(),
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

describe("snapshotBuilder / restoreBuilder", () => {
    it("copies the collections so later edits don't leak into the snapshot", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);

        state.players.delete(6);
        state.cardsFlipped.delete(6);
        state.comparison.delete(6);
        state.details.name = "Changed";
        state.loadedTeam.uuid = null;

        expect(snapshot.players.get(6)).toBe(lawson);
        expect(snapshot.cardsFlipped.get(6)).toBe(true);
        expect(snapshot.comparison.has(6)).toBe(true);
        expect(snapshot.details.name).toBe("Rip City");
        expect(snapshot.loadedTeam.uuid).toBe("team-a");
    });

    it("puts a removed player back in the same slot with the same object", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);
        state.players.delete(6);
        state.cardsFlipped.delete(6);
        state.comparison.delete(6);

        const next = restoreBuilder(state, snapshot);

        // Same object, so the career stats come back without a refetch.
        expect(next.players.get(6)).toBe(lawson);
        expect(next.cardsFlipped.get(6)).toBe(true);
        expect(next.comparison.has(6)).toBe(true);
        expect([...next.players.keys()]).toEqual([1, 6, 7]);
    });

    it("keeps card and comparison state on slots the undo doesn't touch", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);
        state.players.delete(6);
        state.cardsFlipped.delete(6);
        state.comparison.delete(6);
        // Flipped after the removal - not part of what's undone.
        state.cardsFlipped.set(7, true);

        const next = restoreBuilder(state, snapshot);

        expect(next.cardsFlipped.get(7)).toBe(true);
        expect(next.cardsFlipped.get(1)).toBe(false);
    });

    it("moves flip and comparison state back with a swapped pair", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);
        // Lawson (flipped, picked) and Olajuwon trade slots 6 and 7.
        state.players.set(6, olajuwon);
        state.players.set(7, lawson);
        state.cardsFlipped.set(6, false);
        state.cardsFlipped.set(7, true);
        state.comparison = new Set([7]);

        const next = restoreBuilder(state, snapshot);

        expect(next.players.get(6)).toBe(lawson);
        expect(next.players.get(7)).toBe(olajuwon);
        expect(next.cardsFlipped.get(6)).toBe(true);
        expect(next.cardsFlipped.get(7)).toBe(false);
        expect([...next.comparison]).toEqual([6]);
    });

    // Two picks is what opens the comparison; a restore that made a pair
    // would leave it closed with both picks stuck.
    it("never completes a comparison pair", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);
        state.players.delete(6);
        state.comparison.delete(6);
        state.comparison.add(1);

        const next = restoreBuilder(state, snapshot);

        expect([...next.comparison]).toEqual([1]);
    });

    it("leaves team details alone unless the entry covers them", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);
        state.players.delete(6);
        // Typed after the removal; not undoable yet, so an undo must keep it.
        state.details.name = "Blazers";

        expect(restoreBuilder(state, snapshot).details.name).toBe("Blazers");
        expect(restoreBuilder(state, snapshot, { details: true }).details.name).toBe("Rip City");
    });

    describe("undoing Clear Team on a saved team", () => {
        it("brings back the roster, every detail and the loaded team", () => {
            const before = builder();
            const snapshot = snapshotBuilder(before);

            const next = restoreBuilder(cleared(), snapshot, { details: true });

            expect([...next.players.entries()]).toEqual([...before.players.entries()]);
            expect(next.details).toEqual(before.details);
            expect(next.details.coach).toBe(before.details.coach);
            // Save updates team-a in place instead of creating a duplicate.
            expect(next.loadedTeam).toEqual({
                uuid: "team-a",
                isPublic: true,
                cardUrl: "https://cdn/card.png",
                owner: "yusuf",
            });
        });

        it("clears it all again on redo", () => {
            const before = builder();
            const afterClear = snapshotBuilder(cleared());

            const next = restoreBuilder(before, afterClear, { details: true });

            expect(next.players.size).toBe(0);
            expect(next.details.name).toBe("");
            expect(next.details.coach).toBeNull();
            expect(next.loadedTeam.uuid).toBeNull();
            expect(next.loadedTeam.isPublic).toBe(false);
        });
    });

    // isPublic / cardUrl / owner are the server's record of the loaded team,
    // not builder edits: publishing isn't undoable, so undoing a roster change
    // made before it must not flip the team back to private.
    it("keeps the current share state while the loaded team is unchanged", () => {
        const state = builder();
        state.loadedTeam.isPublic = false;
        state.loadedTeam.cardUrl = null;
        const snapshot = snapshotBuilder(state);
        state.players.delete(6);
        state.loadedTeam.isPublic = true;
        state.loadedTeam.cardUrl = "https://cdn/card-2.png";

        const next = restoreBuilder(state, snapshot);

        expect(next.loadedTeam).toEqual({
            uuid: "team-a",
            isPublic: true,
            cardUrl: "https://cdn/card-2.png",
            owner: "yusuf",
        });
    });
});
