import { describe, it, expect } from "vitest";
import { slugFilename } from "@/utils/downloadFile";

describe("slugFilename", () => {
    it("slugifies a team name into a lowercase, hyphenated filename", () => {
        expect(slugFilename("Chicago Bulls '96!", "png")).toBe("chicago-bulls-96-.png");
    });

    it("falls back to 'team' for an empty name", () => {
        expect(slugFilename("", "png")).toBe("team.png");
    });
});
