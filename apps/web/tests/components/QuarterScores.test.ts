import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import QuarterScores from "@/components/BoxScore/QuarterScores.vue";
import type { ESPNCompetitor, ESPNLineScore, ESPNTeamPlayers } from "@/models/types";

// The summary endpoint (this component's real data source) sends only
// displayValue - no value, no period, no winner. displayValue-only is the
// default here on purpose; the scoreboard shape gets its own test below.
const competitor = (
    homeAway: "home" | "away",
    linescores: ESPNLineScore[] = [{ displayValue: "25" }, { displayValue: "30" }],
    overrides: Partial<ESPNCompetitor> = {},
): ESPNCompetitor =>
    ({
        homeAway,
        score: "55",
        team: { abbreviation: homeAway === "home" ? "HOM" : "AWY", logo: "" },
        linescores,
        ...overrides,
    }) as ESPNCompetitor;

describe("QuarterScores", () => {
    it("renders the table when both teams are present with line scores", () => {
        const wrapper = mount(QuarterScores, {
            props: { competitors: [competitor("away"), competitor("home")] },
        });

        expect(wrapper.find("table").exists()).toBe(true);
    });

    it("renders per-quarter cells from the summary endpoint's displayValue-only shape", () => {
        const wrapper = mount(QuarterScores, {
            props: {
                competitors: [
                    competitor("away", [{ displayValue: "33" }, { displayValue: "24" }]),
                    competitor("home", [{ displayValue: "22" }, { displayValue: "42" }]),
                ],
            },
        });

        const text = wrapper.text();
        expect(text).toContain("33");
        expect(text).toContain("24");
        expect(text).toContain("22");
        expect(text).toContain("42");
    });

    it("still renders the scoreboard endpoint's value-only shape", () => {
        const wrapper = mount(QuarterScores, {
            props: {
                competitors: [
                    competitor("away", [{ value: 33 }, { value: 24 }]),
                    competitor("home", [{ value: 22 }, { value: 42 }]),
                ],
            },
        });

        const text = wrapper.text();
        expect(text).toContain("33");
        expect(text).toContain("42");
    });

    it("highlights the higher total when `winner` is absent, by comparing scores", () => {
        const wrapper = mount(QuarterScores, {
            props: {
                competitors: [
                    competitor("away", undefined, { score: "115" }),
                    competitor("home", undefined, { score: "111" }),
                ],
            },
        });

        const totalCell = wrapper
            .findAll("td")
            .find((cell) => cell.text() === "115");
        expect(totalCell?.classes()).toContain("text-primary");
    });

    it("falls back to boxscore.players' logo when a summary competitor's team.logo is null", () => {
        const players = [
            { team: { abbreviation: "AWY", logo: "https://example.test/away.png" } },
            { team: { abbreviation: "HOM", logo: "https://example.test/home.png" } },
        ] as ESPNTeamPlayers[];

        const wrapper = mount(QuarterScores, {
            props: {
                competitors: [
                    competitor("away", undefined, { team: { abbreviation: "AWY", logo: null } as any }),
                    competitor("home", undefined, { team: { abbreviation: "HOM", logo: null } as any }),
                ],
                players,
            },
        });

        const srcs = wrapper.findAll("img").map((img) => img.attributes("src"));
        expect(srcs).toEqual([
            "https://example.test/away.png",
            "https://example.test/home.png",
        ]);
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
