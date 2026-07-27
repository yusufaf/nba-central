import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RosterSection from "@/components/TeamBuilder/RosterSection.vue";

// Stub the PlayerSlot child so this test stays focused on RosterSection's own
// counting logic rather than rendering the full slot tree.
const mountRoster = (selected: Map<number, any>) =>
    mount(RosterSection, {
        props: {
            selectedPlayers: selected,
            cardsFlipped: new Map<number, boolean>(),
        },
        global: {
            stubs: { PlayerSlot: true },
        },
    });

const player = (id: number) => ({
    id,
    fullName: `Player ${id}`,
    first_name: "P",
    last_name: `${id}`,
    position: "PG",
    team: { full_name: "Team", abbreviation: "TM" },
});

describe("RosterSection", () => {
    it("renders 0 counts for an empty roster", () => {
        const wrapper = mountRoster(new Map());
        const counts = wrapper.findAll(".starter-count").map((n) => n.text());
        expect(counts).toEqual(["0/5", "0/10"]);
    });

    it("counts starters (1-5) and bench (6-15) separately", () => {
        const selected = new Map<number, any>([
            [1, player(1)],
            [2, player(2)],
            [6, player(6)],
        ]);
        const wrapper = mountRoster(selected);
        const counts = wrapper.findAll(".starter-count").map((n) => n.text());
        expect(counts).toEqual(["2/5", "1/10"]);
    });
});
