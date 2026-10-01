import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import ScoreCard from "@/components/Scores/ScoreCard.vue";
import type { ESPNCompetitor } from "@/models/types";
import finalEvent from "./fixtures/scoreboard-event-final.json";
import scheduledEvent from "./fixtures/scoreboard-event-scheduled.json";

// Scores.vue flattens each ESPN event this way before handing it to a card.
const mountCard = (event: unknown) => {
    const e = event as { competitions: { status: unknown; competitors: ESPNCompetitor[] }[] };
    const competition = e.competitions[0];
    return mount(ScoreCard, {
        props: {
            game: { ...e, status: competition.status, competitors: competition.competitors },
            index: 0,
            gameTeams: [competition.competitors],
            customizationState: new Map(),
        },
        global: { stubs: { TeamDetailsTooltip: true } },
    });
};

describe("ScoreCard", () => {
    it("shows each team's top performer for a finished game", () => {
        const wrapper = mountCard(finalEvent);

        expect(wrapper.find(".leaders-section").exists()).toBe(true);
        expect(wrapper.text()).toContain("Top Performers");
        expect(wrapper.findAll(".leader")).toHaveLength(2);
        expect(wrapper.text()).toContain("T. Maxey - G");
        expect(wrapper.text()).toContain("31 PTS, 6 AST");
    });

    // ESPN sends preseason and early-season scheduled games with no
    // `leaders`. This used to throw while rendering, which blanked the whole
    // scoreboard, not just this card (#141).
    it("renders a scheduled game with no leaders yet, without a leaders section", () => {
        const wrapper = mountCard(scheduledEvent);

        expect(wrapper.find(".score-card").exists()).toBe(true);
        expect(wrapper.text()).toContain("Atlanta Hawks at Orlando Magic");
        expect(wrapper.find(".leaders-section").exists()).toBe(false);
        expect(wrapper.text()).not.toContain("Players to Watch");
    });

    it("keeps a lone home leader on the home side", () => {
        const e = finalEvent as unknown as { competitions: { competitors: ESPNCompetitor[] }[] };
        const [home, away] = e.competitions[0].competitors;
        const homeOnly = {
            ...e,
            competitions: [{ ...e.competitions[0], competitors: [home, { ...away, leaders: undefined }] }],
        };
        const slots = mountCard(homeOnly).findAll(".leaders > div");

        expect(slots).toHaveLength(2);
        expect(slots[0].text()).toBe("");
        expect(slots[1].text()).toContain("T. Maxey - G");
    });
});
