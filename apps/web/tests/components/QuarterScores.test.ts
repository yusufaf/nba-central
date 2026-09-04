import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import QuarterScores from "@/components/BoxScore/QuarterScores.vue";
import type { ESPNCompetitor } from "@/models/types";

const competitor = (
    homeAway: "home" | "away",
    linescores: { value: number }[] = [{ value: 25 }, { value: 30 }],
): ESPNCompetitor =>
    ({
        homeAway,
        winner: false,
        score: "55",
        team: { abbreviation: homeAway === "home" ? "HOM" : "AWY" },
        linescores,
    }) as ESPNCompetitor;

describe("QuarterScores", () => {
    it("renders the table when both teams are present with line scores", () => {
        const wrapper = mount(QuarterScores, {
            props: { competitors: [competitor("away"), competitor("home")] },
        });

        expect(wrapper.find("table").exists()).toBe(true);
    });

    it("renders nothing, and does not throw, when the home competitor is missing", () => {
        expect(() =>
            mount(QuarterScores, {
                props: { competitors: [competitor("away")] },
            }),
        ).not.toThrow();

        const wrapper = mount(QuarterScores, {
            props: { competitors: [competitor("away")] },
        });
        expect(wrapper.find("table").exists()).toBe(false);
    });

    it("renders nothing, and does not throw, for an empty competitors array", () => {
        expect(() =>
            mount(QuarterScores, { props: { competitors: [] } }),
        ).not.toThrow();
    });
});
