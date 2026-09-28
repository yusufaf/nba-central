import { describe, it, expect } from "vitest";
import {
    restoreBuilder,
    snapshotBuilder,
    useTeamHistory,
    type BuilderState,
} from "@/composables/useTeamHistory";

// A stand-in for the builder: history only cares that capture/restore round-trip.
const setup = (limit?: number) => {
    const state = { roster: ["Duckworth", "Lawson"] };
    const history = useTeamHistory({
        capture: () => [...state.roster],
        restore: (snapshot) => {
            state.roster = [...snapshot];
        },
        limit,
    });
    return { state, ...history };
};

describe("useTeamHistory", () => {
    it("starts empty", () => {
        const { canUndo } = setup();
        expect(canUndo.value).toBe(false);
    });

    it("restores the state captured by push", () => {
        const { state, push, undo, canUndo } = setup();

        push("Removed Lawson");
        state.roster = ["Duckworth"];
        expect(canUndo.value).toBe(true);

        const entry = undo();
        expect(entry?.label).toBe("Removed Lawson");
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
        expect(canUndo.value).toBe(false);
    });

    it("does nothing when undoing an empty stack", () => {
        const { state, undo } = setup();

        expect(undo()).toBeUndefined();
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
    });

    it("undoes several changes in reverse order", () => {
        const { state, push, undo } = setup();

        push("Removed Lawson");
        state.roster = ["Duckworth"];
        push("Removed Duckworth");
        state.roster = [];

        expect(undo()?.label).toBe("Removed Duckworth");
        expect(state.roster).toEqual(["Duckworth"]);
        expect(undo()?.label).toBe("Removed Lawson");
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
        expect(undo()).toBeUndefined();
    });

    it("captures at push time, not at undo time", () => {
        const { state, push, undo } = setup();

        push("Removed Lawson");
        state.roster.pop();
        undo();
        expect(state.roster).toEqual(["Duckworth", "Lawson"]);
    });

    it("tells whether an entry is still the next one to undo", () => {
        const { state, push, undo, isLatest } = setup();

        const first = push("Removed Lawson");
        state.roster = ["Duckworth"];
        const second = push("Removed Duckworth");
        expect(isLatest(first)).toBe(false);
        expect(isLatest(second)).toBe(true);

        undo();
        expect(isLatest(second)).toBe(false);
        expect(isLatest(first)).toBe(true);
    });

    it("forgets everything on clear", () => {
        const { state, push, undo, clear, canUndo } = setup();

        push("Removed Lawson");
        state.roster = ["Duckworth"];
        clear();

        expect(canUndo.value).toBe(false);
        expect(undo()).toBeUndefined();
        expect(state.roster).toEqual(["Duckworth"]);
    });

    it("drops the oldest entries past the limit", () => {
        const { state, push, undo } = setup(2);

        push("one");
        state.roster = ["Duckworth"];
        push("two");
        state.roster = [];
        push("three");
        state.roster = ["Lawson"];

        expect(undo()?.label).toBe("three");
        expect(undo()?.label).toBe("two");
        expect(undo()).toBeUndefined();
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
    loadedTeamUUID: "team-a",
});

describe("snapshotBuilder / restoreBuilder", () => {
    it("copies the collections so later edits don't leak into the snapshot", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);

        state.players.delete(6);
        state.cardsFlipped.delete(6);
        state.comparison.delete(6);

        expect(snapshot.players.get(6)).toBe(lawson);
        expect(snapshot.cardsFlipped.get(6)).toBe(true);
        expect(snapshot.comparison.has(6)).toBe(true);
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
        // Flipped and compared after the removal - not part of what's undone.
        state.cardsFlipped.set(7, true);
        state.comparison.add(1);

        const next = restoreBuilder(state, snapshot);

        expect(next.cardsFlipped.get(7)).toBe(true);
        expect(next.comparison.has(1)).toBe(true);
        expect(next.comparison.has(6)).toBe(true);
    });

    it("never restores a third comparison pick", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);
        state.players.delete(6);
        state.comparison.delete(6);
        state.comparison.add(1);
        state.comparison.add(7);

        const next = restoreBuilder(state, snapshot);

        expect([...next.comparison].sort()).toEqual([1, 7]);
    });

    it("restores the loaded team", () => {
        const state = builder();
        const snapshot = snapshotBuilder(state);
        state.loadedTeamUUID = null;

        expect(restoreBuilder(state, snapshot).loadedTeamUUID).toBe("team-a");
    });
});
