import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PlayerStatsTable from "@/components/BoxScore/PlayerStatsTable.vue";
import type { ESPNPlayerStat, ESPNPlayerStatistics, ESPNTeamInfo } from "@/models/types";

const team = { displayName: "Hawks", abbreviation: "ATL", logo: "" } as ESPNTeamInfo;

const player = (id: string, overrides: Partial<ESPNPlayerStat> = {}): ESPNPlayerStat =>
    ({
        athlete: {
            id,
            displayName: `Player ${id}`,
            position: { abbreviation: "F" },
            jersey: "7",
        },
        starter: false,
        stats: [],
        ...overrides,
    }) as ESPNPlayerStat;

const mountTable = (athletes: ESPNPlayerStat[]) =>
    mount(PlayerStatsTable, {
        props: {
            team,
            statistics: {
                names: ["MIN", "PTS", "REB"],
                keys: [],
                labels: [],
                descriptions: [],
                athletes,
                totals: ["-", "114", "48"],
            } as ESPNPlayerStatistics,
        },
    });

const rowFor = (wrapper: ReturnType<typeof mountTable>, name: string) =>
    wrapper.findAll("tbody tr").find((tr) => tr.text().includes(name))!;

const expandDnp = async (wrapper: ReturnType<typeof mountTable>) => {
    const toggle = wrapper.findAll("button").find((b) => b.text().includes("Did Not Play"));
    await toggle!.trigger("click");
};

describe("PlayerStatsTable DNP rows", () => {
    it("shows the reason next to DNP in the stat cell, not under the player name", async () => {
        const wrapper = mountTable([
            player("1", { didNotPlay: true, reason: "COACH'S DECISION" }),
        ]);
        await expandDnp(wrapper);

        const [nameCell, dnpCell] = rowFor(wrapper, "Player 1").findAll("td");

        expect(dnpCell.text()).toBe("DNP — COACH'S DECISION");
        expect(nameCell.text()).toContain("Player 1");
        expect(nameCell.text()).toContain("F");
        expect(nameCell.text()).not.toContain("COACH'S DECISION");
    });

    it("shows a bare DNP when ESPN gives no reason", async () => {
        const wrapper = mountTable([player("2", { didNotPlay: true })]);
        await expandDnp(wrapper);

        const [, dnpCell] = rowFor(wrapper, "Player 2").findAll("td");

        expect(dnpCell.text()).toBe("DNP");
    });
});
