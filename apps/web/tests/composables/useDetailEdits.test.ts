import { afterEach, describe, it, expect } from "vitest";
import { effectScope } from "vue";
import { useDetailEdits } from "@/composables/useDetailEdits";
import {
    restoreBuilder,
    snapshotBuilder,
    useTeamHistory,
    type BuilderState,
    type TeamDetails,
} from "@/composables/useTeamHistory";

const duckworth = { id: "duckwo01", fullName: "Duckworth" };
const lawson = { id: "lawsoa01", fullName: "Lawson" };

const billups = { name: "Chauncey Billups" };
const jackson = { name: "Phil Jackson*" };

const initialDetails = (): TeamDetails => ({
    name: "Rip City",
    description: "",
    city: "Portland",
    country: "USA",
    logo: "https://cdn/logo.png",
    jersey: "https://cdn/jersey.png",
    coach: billups,
    arena: null,
    gm: null,
});

const scopes: ReturnType<typeof effectScope>[] = [];

afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    document.body.innerHTML = "";
});

// Wired the way TeamBuilder wires it: roster changes push straight to the
// history, detail edits go through useDetailEdits, and undo restores the
// whole builder.
const setup = () => {
    const state: BuilderState<object> = {
        players: new Map<number, object>([[1, duckworth]]),
        cardsFlipped: new Map([[1, false]]),
        comparison: new Set(),
        details: initialDetails(),
        loadedTeam: { uuid: "team-a", isPublic: false, cardUrl: null, owner: "yusuf" },
    };
    const history = useTeamHistory<BuilderState<object>>({
        capture: () => snapshotBuilder(state),
        restore: (snapshot) => {
            Object.assign(state, restoreBuilder(state, snapshot));
        },
    });
    const scope = effectScope();
    scopes.push(scope);
    const { edit } = scope.run(() =>
        useDetailEdits({
            details: () => state.details,
            apply: (field, value) => {
                state.details = { ...state.details, [field]: value };
            },
            record: history.push,
            baseFor: (mergeKey) => history.mergeTarget(mergeKey)?.snapshot.details,
        }),
    )!;

    // Letters one at a time, the way the name input emits them.
    const type = (field: "name" | "city" | "country" | "description", text: string) => {
        for (let i = 1; i <= text.length; i++) edit(field, text.slice(0, i));
    };

    return { state, history, edit, type };
};

const focus = (html: string, selector: string) => {
    document.body.innerHTML = html;
    document.querySelector(selector)!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
};

const focusName = () => focus(`<input id="team-name">`, "#team-name");
// The customization dialog: reka renders it as role="dialog".
const focusInDialog = (id: string) =>
    focus(`<div role="dialog" data-state="open"><input id="${id}"><button id="swatch"></button></div>`, `#${id}`);

const nextTick = () => Promise.resolve();

describe("useDetailEdits", () => {
    describe("text fields", () => {
        it("undoes a burst of typing in one step, back to the value before the first keystroke", async () => {
            const { state, history, type } = setup();
            focusName();

            type("name", "Blazers");
            await nextTick();
            expect(state.details.name).toBe("Blazers");

            const entry = history.undo();
            expect(entry?.undoLabel).toBe("Restored team name");
            expect(entry?.redoLabel).toBe("Renamed team to Blazers");
            expect(state.details.name).toBe("Rip City");
            expect(history.canUndo.value).toBe(false);

            expect(history.redo()?.redoLabel).toBe("Renamed team to Blazers");
            expect(state.details.name).toBe("Blazers");
        });

        it("starts a new step when the field is focused again", async () => {
            const { state, history, type, edit } = setup();
            focusName();
            type("name", "Blazers");
            await nextTick();

            focusName();
            edit("name", "Blazers 2");
            await nextTick();

            history.undo();
            expect(state.details.name).toBe("Blazers");
            history.undo();
            expect(state.details.name).toBe("Rip City");
        });

        it("keeps each field's typing separate", async () => {
            const { state, history, type } = setup();
            focusInDialog("team-city");
            type("city", "Seattle");
            await nextTick();
            focusInDialog("team-country");
            type("country", "US");
            await nextTick();

            expect(history.undo()?.undoLabel).toBe("Restored country");
            expect(state.details).toMatchObject({ city: "Seattle", country: "USA" });
            expect(history.undo()?.undoLabel).toBe("Restored city");
            expect(state.details).toMatchObject({ city: "Portland", country: "USA" });
        });

        it("labels a cleared field as cleared", () => {
            const { history, edit } = setup();
            focusName();
            edit("name", "Rip Cit");
            edit("name", "");

            expect(history.undo()?.redoLabel).toBe("Cleared team name");
        });

        it("records nothing when the value didn't change", () => {
            const { history, edit } = setup();
            edit("name", "Rip City");
            edit("coach", billups);
            expect(history.canUndo.value).toBe(false);
        });
    });

    describe("picking a historical team", () => {
        // TeamCustomizationDialog sets city then country in one handler.
        it("undoes city and country together", async () => {
            const { state, history, edit } = setup();
            focusInDialog("combobox-search");

            edit("city", "Boston");
            edit("country", "United States");
            await nextTick();

            const entry = history.undo();
            expect(entry?.undoLabel).toBe("Restored city and country");
            expect(entry?.redoLabel).toBe("Moved team to Boston, United States");
            expect(state.details).toMatchObject({ city: "Portland", country: "USA" });
            expect(history.canUndo.value).toBe(false);
        });

        it("labels just the field that changed when the other one matches", () => {
            const { history, edit } = setup();
            edit("city", "Boston");
            edit("country", "USA");

            expect(history.undo()?.redoLabel).toBe("Changed city to Boston");
        });

        it("doesn't fold edits from the next tick into it", async () => {
            const { state, history, edit } = setup();
            edit("logo", "https://cdn/celtics.png");
            await nextTick();
            edit("jersey", "https://cdn/celtics-jersey.png");
            await nextTick();

            history.undo();
            expect(state.details.logo).toBe("https://cdn/celtics.png");
            expect(state.details.jersey).toBe("https://cdn/jersey.png");
        });
    });

    describe("logo, jersey and staff", () => {
        it("gives every pick its own step", async () => {
            const { state, history, edit } = setup();
            focusInDialog("swatch");
            edit("logo", "https://cdn/a.png");
            await nextTick();
            edit("logo", "https://cdn/b.png");
            await nextTick();

            expect(history.undo()?.undoLabel).toBe("Restored team logo");
            expect(state.details.logo).toBe("https://cdn/a.png");
            history.undo();
            expect(state.details.logo).toBe("https://cdn/logo.png");
        });

        it("names the coach it changes to and the one it restores", async () => {
            const { state, history, edit } = setup();
            edit("coach", jackson);
            await nextTick();

            const entry = history.undo();
            expect(entry?.redoLabel).toBe("Changed coach to Phil Jackson");
            expect(entry?.undoLabel).toBe("Restored Chauncey Billups as coach");
            expect(state.details.coach).toBe(billups);
        });

        it("labels adding and removing staff", async () => {
            const { history, edit } = setup();
            edit("arena", { name: "Moda Center" });
            await nextTick();
            edit("coach", null);
            await nextTick();

            expect(history.undo()).toMatchObject({
                undoLabel: "Restored Chauncey Billups as coach",
                redoLabel: "Removed Chauncey Billups as coach",
            });
            expect(history.undo()).toMatchObject({
                undoLabel: "Removed Moda Center as arena",
                redoLabel: "Changed arena to Moda Center",
            });
        });

        it("undoes a whole drawing session in one step", async () => {
            const { state, history, edit } = setup();
            focusInDialog("swatch");
            edit("jersey", "data:image/png;base64,stroke1");
            await nextTick();
            // Picking another colour between strokes moves focus inside the dialog.
            focusInDialog("swatch");
            edit("jersey", "data:image/png;base64,stroke2");
            await nextTick();

            expect(history.undo()?.undoLabel).toBe("Restored team jersey");
            expect(state.details.jersey).toBe("https://cdn/jersey.png");
            expect(history.canUndo.value).toBe(false);
        });

        it("starts a new drawing step once the dialog has been left", async () => {
            const { state, history, edit } = setup();
            focusInDialog("swatch");
            edit("jersey", "data:image/png;base64,first");
            await nextTick();
            // Closing the dialog hands focus back to the button that opened it.
            focus(`<button id="settings"></button>`, "#settings");
            focusInDialog("swatch");
            edit("jersey", "data:image/png;base64,second");
            await nextTick();

            history.undo();
            expect(state.details.jersey).toBe("data:image/png;base64,first");
        });
    });

    it("interleaves roster and detail changes in the order they were made", async () => {
        const { state, history, edit, type } = setup();
        const roster = () => [...state.players.entries()];

        // Add Lawson to slot 6.
        history.push({ undoLabel: "Removed Lawson", redoLabel: "Added Lawson" });
        state.players.set(6, lawson);
        await nextTick();

        focusName();
        type("name", "Blazers");
        await nextTick();

        // Swap Duckworth and Lawson.
        history.push({ undoLabel: "Swapped back", redoLabel: "Swapped" });
        state.players.set(1, lawson);
        state.players.set(6, duckworth);
        await nextTick();

        edit("coach", jackson);
        await nextTick();

        const undone = [history.undo(), history.undo(), history.undo(), history.undo()];
        expect(undone.map((entry) => entry?.undoLabel)).toEqual([
            "Restored Chauncey Billups as coach",
            "Swapped back",
            "Restored team name",
            "Removed Lawson",
        ]);
        expect(roster()).toEqual([[1, duckworth]]);
        expect(state.details).toEqual(initialDetails());

        const redone = [history.redo(), history.redo(), history.redo(), history.redo()];
        expect(redone.map((entry) => entry?.redoLabel)).toEqual([
            "Added Lawson",
            "Renamed team to Blazers",
            "Swapped",
            "Changed coach to Phil Jackson",
        ]);
        expect(roster()).toEqual([
            [1, lawson],
            [6, duckworth],
        ]);
        expect(state.details).toMatchObject({ name: "Blazers", coach: jackson });
    });

    it("leaves the roster and the loaded team alone when undoing a detail edit", async () => {
        const { state, history, edit } = setup();
        edit("coach", jackson);
        await nextTick();
        // Flipped and published after the edit - neither is something undo rewinds.
        state.cardsFlipped.set(1, true);
        state.loadedTeam = { uuid: "team-a", isPublic: true, cardUrl: "https://cdn/card.png", owner: "yusuf" };

        history.undo();

        expect(state.details.coach).toBe(billups);
        expect([...state.players.entries()]).toEqual([[1, duckworth]]);
        expect(state.cardsFlipped.get(1)).toBe(true);
        expect(state.loadedTeam.isPublic).toBe(true);
        expect(state.loadedTeam.cardUrl).toBe("https://cdn/card.png");
    });
});
