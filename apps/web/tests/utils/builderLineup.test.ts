import { describe, expect, it } from "vitest";
import {
    lineupBuilderLink,
    parsePlayersParam,
    starterSlots,
    type PositionedPlayer,
} from "@/utils/builderLineup";

const at = (id: string, positions: string[]): PositionedPlayer => ({ id, positions });

const placed = (players: PositionedPlayer[]) =>
    [...starterSlots(players)].sort(([a], [b]) => a - b).map(([slot, p]) => `${slot}:${p.id}`);

describe("parsePlayersParam", () => {
    it("splits and trims a comma list", () => {
        expect(parsePlayersParam(" a, b ,c")).toEqual(["a", "b", "c"]);
    });

    it("drops blanks and repeats", () => {
        expect(parsePlayersParam("a,,a,b")).toEqual(["a", "b"]);
    });

    it("keeps at most five", () => {
        expect(parsePlayersParam("a,b,c,d,e,f,g")).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("reads anything but a non-empty string as no one", () => {
        expect(parsePlayersParam(undefined)).toEqual([]);
        expect(parsePlayersParam(["a", "b"])).toEqual([]);
        expect(parsePlayersParam("")).toEqual([]);
        expect(parsePlayersParam(",,")).toEqual([]);
    });
});

describe("lineupBuilderLink", () => {
    it("opens the builder with the ids comma-joined", () => {
        expect(lineupBuilderLink(["a", "b"])).toEqual({
            path: "/teambuilder",
            query: { players: "a,b" },
        });
    });
});

describe("starterSlots", () => {
    it("keeps pick order when no one has a position", () => {
        const players = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
        expect(placed(players)).toEqual(["1:a", "2:b", "3:c", "4:d", "5:e"]);
    });

    it("puts each player at a position they play", () => {
        const players = [
            at("c", ["C"]),
            at("pg", ["PG"]),
            at("sf", ["SF"]),
            at("sg", ["SG"]),
            at("pf", ["PF"]),
        ];
        expect(placed(players)).toEqual(["1:pg", "2:sg", "3:sf", "4:pf", "5:c"]);
    });

    it("gives the first of five centres the C slot and the rest the others in pick order", () => {
        const players = ["a", "b", "c", "d", "e"].map((id) => at(id, ["C"]));
        expect(placed(players)).toEqual(["1:b", "2:c", "3:d", "4:e", "5:a"]);
    });

    it("gives a contested position to the earlier pick", () => {
        const players = [
            at("a", ["SF"]),
            at("b", ["SF"]),
            at("c", ["C"]),
            at("d", ["C"]),
            at("e", ["C"]),
        ];
        expect(placed(players)).toEqual(["1:b", "2:d", "3:a", "4:e", "5:c"]);
    });

    it("moves a dual-position player so both play in position", () => {
        expect(placed([at("a", ["PG", "SG"]), at("b", ["PG"])])).toEqual(["1:b", "2:a"]);
    });

    it("lets an earlier pick out of position take the earlier free slot", () => {
        const players = [at("a", ["C"]), at("b", ["C"]), at("c", ["PG", "SG"])];
        expect(placed(players)).toEqual(["1:b", "2:c", "5:a"]);
    });

    it("reads Basketball-Reference's coarse positions", () => {
        const players = [
            { id: "g", position: "G" },
            { id: "c", position: "C" },
        ];
        expect(placed(players)).toEqual(["1:g", "5:c"]);
    });

    it("places only the first five", () => {
        const players = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id }));
        const slots = starterSlots(players);
        expect([...slots.keys()].sort()).toEqual([1, 2, 3, 4, 5]);
        expect(placed(players)).toEqual(["1:a", "2:b", "3:c", "4:d", "5:e"]);
    });
});
