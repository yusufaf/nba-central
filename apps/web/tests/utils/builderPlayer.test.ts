import { describe, expect, it } from "vitest";
import { compareTeamNames } from "@/utils/builderPlayer";
import type { Player } from "@/models/types";

type Row = Pick<Player, "team"> & { id: string };

const celtics: Row = { id: "bos", team: { full_name: "Boston Celtics", abbreviation: "BOS" } };
const heat: Row = { id: "mia", team: { full_name: "Miami Heat", abbreviation: "MIA" } };
const freeAgent: Row = { id: "fa", team: { full_name: "", abbreviation: "" } };
const custom: Row = { id: "custom" };

const sorted = (rows: Row[], modifier: 1 | -1) =>
    [...rows].sort((a, b) => compareTeamNames(a, b, modifier)).map((r) => r.id);

describe("compareTeamNames", () => {
    it("orders by team name ascending", () => {
        expect(sorted([heat, celtics], 1)).toEqual(["bos", "mia"]);
    });

    it("reverses descending", () => {
        expect(sorted([celtics, heat], -1)).toEqual(["mia", "bos"]);
    });

    it("puts players without a team last in both directions", () => {
        const rows = [freeAgent, custom, heat, celtics];
        expect(sorted(rows, 1).slice(0, 2)).toEqual(["bos", "mia"]);
        expect(sorted(rows, -1).slice(0, 2)).toEqual(["mia", "bos"]);
    });

    it("ties two players without a team", () => {
        expect(compareTeamNames(freeAgent, custom, 1)).toBe(0);
        expect(compareTeamNames(custom, freeAgent, -1)).toBe(0);
    });
});
