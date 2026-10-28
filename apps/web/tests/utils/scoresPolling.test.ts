import { describe, it, expect } from "vitest";
import type { ESPNEvent } from "@/models/types";
import { shouldPollScoreboard } from "@/utils/scoresPolling";

const HOUR = 3_600_000;
// Local noon, so "today" and "yesterday" don't depend on the test's timezone.
const NOW = new Date(2026, 9, 27, 12, 0);
const TODAY = new Date(2026, 9, 27);
const YESTERDAY = new Date(2026, 9, 26);
const IN_3_DAYS = new Date(2026, 9, 30);

const game = (state: "pre" | "in" | "post", startOffsetMs: number, completed = state === "post") =>
    ({
        date: new Date(NOW.getTime() + startOffsetMs).toISOString(),
        competitions: [{ status: { type: { state, completed } } }],
    }) as unknown as ESPNEvent;

describe("shouldPollScoreboard", () => {
    it.each<[string, ESPNEvent[], Date, boolean]>([
        ["today with a game 5 hours away", [game("pre", 5 * HOUR)], TODAY, true],
        ["today, every game final", [game("post", -3 * HOUR), game("post", -HOUR)], TODAY, false],
        ["yesterday with a late game still on", [game("in", -3 * HOUR)], YESTERDAY, true],
        ["another day with a game 30 minutes away", [game("pre", 30 * 60_000)], YESTERDAY, true],
        ["a past day with a game stuck in pre for 2 days", [game("pre", -48 * HOUR)], YESTERDAY, false],
        ["3 days ahead", [game("pre", 72 * HOUR)], IN_3_DAYS, false],
        ["an event with no competition", [{ date: NOW.toISOString(), competitions: [] } as unknown as ESPNEvent], TODAY, false],
        ["no games", [], TODAY, false],
    ])("%s", (_, events, forDate, expected) => {
        expect(shouldPollScoreboard(events, forDate, NOW)).toBe(expected);
    });
});
