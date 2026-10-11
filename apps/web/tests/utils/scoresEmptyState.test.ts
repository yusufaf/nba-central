import { describe, it, expect } from "vitest";
import { getScoresEmptyReason } from "@/utils/scoresEmptyState";

describe("getScoresEmptyReason", () => {
    it("is none when something is visible", () => {
        expect(getScoresEmptyReason({ totalGames: 7, filteredGames: 5, visibleGames: 2 })).toBe("none");
    });

    it("is no-games when the date has no games", () => {
        expect(getScoresEmptyReason({ totalGames: 0, filteredGames: 0, visibleGames: 0 })).toBe("no-games");
    });

    it("is conference when the filter removes every game", () => {
        expect(getScoresEmptyReason({ totalGames: 7, filteredGames: 0, visibleGames: 0 })).toBe("conference");
    });

    it("is all-finished when hiding finished games removes the rest", () => {
        expect(getScoresEmptyReason({ totalGames: 7, filteredGames: 7, visibleGames: 0 })).toBe("all-finished");
    });

    it("is all-finished when the filter keeps games that are then all hidden", () => {
        expect(getScoresEmptyReason({ totalGames: 7, filteredGames: 3, visibleGames: 0 })).toBe("all-finished");
    });
});
