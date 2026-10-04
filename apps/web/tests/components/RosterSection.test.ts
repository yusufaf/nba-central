import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RosterSection from "@/components/TeamBuilder/RosterSection.vue";

// Stub the PlayerSlot child so this test stays focused on RosterSection's own
// counting logic rather than rendering the full slot tree.
const mountRoster = (selected: Map<number, any>, extraProps: object = {}) =>
    mount(RosterSection, {
        props: {
            selectedPlayers: selected,
            cardsFlipped: new Map<number, boolean>(),
            ...extraProps,
        },
        global: {
            stubs: { PlayerSlot: true },
        },
    });

// Slots render starters (1-5) then bench (6-15), so slot N is at index N-1.
// The stub exposes props as DOM attributes, which is enough to assert that the
// drag state lands on the right card.
const slotAt = (wrapper: ReturnType<typeof mountRoster>, slot: number) =>
    wrapper.findAll("player-slot-stub")[slot - 1];

const player = (id: number) => ({
    id,
    fullName: `Player ${id}`,
    first_name: "P",
    last_name: `${id}`,
    position: "PG",
    team: { full_name: "Team", abbreviation: "TM" },
});

const court = {
    version: 1 as const,
    wood: "maple" as const,
    paint: "#4b2a7b",
    apron: "#4b2a7b",
    lines: "#ffffff",
    centerLogo: "upload" as const,
    baselineText: "Harbor Pavilion",
    sidelineText: "Seattle",
};

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

    it("renders all 15 slots across both sections", () => {
        const wrapper = mountRoster(new Map());
        expect(wrapper.findAll("player-slot-stub")).toHaveLength(15);
    });

    it("marks only the dragged, targeted and picked-up slots", () => {
        const selected = new Map<number, any>([
            [6, player(6)],
            [7, player(7)],
        ]);
        const wrapper = mountRoster(selected, {
            draggingSlot: 6,
            dropTargetSlot: 7,
            pickedUpSlot: 1,
        });

        expect(slotAt(wrapper, 6).attributes("isdragging")).toBe("true");
        expect(slotAt(wrapper, 7).attributes("isdragging")).toBe("false");
        expect(slotAt(wrapper, 7).attributes("isdroptarget")).toBe("true");
        expect(slotAt(wrapper, 6).attributes("isdroptarget")).toBe("false");
        expect(slotAt(wrapper, 1).attributes("ispickedup")).toBe("true");
        expect(slotAt(wrapper, 6).attributes("ispickedup")).toBe("false");
    });

    it("tells every slot when a pickup is in progress", () => {
        const wrapper = mountRoster(new Map([[6, player(6)]]), {
            pickedUpSlot: 6,
        });
        expect(slotAt(wrapper, 9).attributes("ispickupactive")).toBe("true");
    });

    it("leaves the pickup flag off when nothing is held", () => {
        const wrapper = mountRoster(new Map([[6, player(6)]]));
        expect(slotAt(wrapper, 9).attributes("ispickupactive")).toBe("false");
    });

    it("announces the live message for the keyboard flow", () => {
        const wrapper = mountRoster(new Map(), {
            liveMessage: "Kevin Duckworth in slot 6 picked up.",
        });
        const live = wrapper.find('[aria-live="polite"]');
        expect(live.text()).toBe("Kevin Duckworth in slot 6 picked up.");
    });

    it("emits cancelPickup on Escape while a card is held", async () => {
        const wrapper = mountRoster(new Map([[6, player(6)]]), {
            pickedUpSlot: 6,
        });
        await wrapper.find(".roster-section").trigger("keydown", { key: "Escape" });
        expect(wrapper.emitted("cancelPickup")).toHaveLength(1);
    });

    it("ignores Escape when nothing is held", async () => {
        const wrapper = mountRoster(new Map([[6, player(6)]]));
        await wrapper.find(".roster-section").trigger("keydown", { key: "Escape" });
        expect(wrapper.emitted("cancelPickup")).toBeUndefined();
    });

    it("renders the starters exactly as before when the arena has no court", () => {
        const wrapper = mountRoster(new Map(), { court: null });
        expect(wrapper.find('[data-testid="court-stage"]').exists()).toBe(false);
        expect(wrapper.find("svg").exists()).toBe(false);
        expect(wrapper.find(".lineup-section > .starters-grid").exists()).toBe(true);
    });

    it("stands the starters, and only the starters, on the court", () => {
        const wrapper = mountRoster(new Map(), { court, courtLogoUrl: "https://cdn.example/logo.png" });
        const stage = wrapper.find('[data-testid="court-stage"]');
        expect(stage.find(".starters-grid").findAll("player-slot-stub")).toHaveLength(5);
        expect(stage.find("image").attributes("href")).toBe("https://cdn.example/logo.png");
        expect(wrapper.findAll('[data-testid="court-stage"]')).toHaveLength(1);
        expect(wrapper.find(".bench-grid").element.closest('[data-testid="court-stage"]')).toBeNull();
    });
});
