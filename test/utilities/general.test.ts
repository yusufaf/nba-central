import { describe, it, expect } from "vitest";
import { capitalizeFirstLetter } from "../../utilities/general";

describe("capitalizeFirstLetter", () => {
    it("capitalizes a lowercase word", () => {
        expect(capitalizeFirstLetter("hello")).toBe("Hello");
    });

    it("leaves an already-capitalized word unchanged", () => {
        expect(capitalizeFirstLetter("World")).toBe("World");
    });

    it("returns empty string for empty input", () => {
        expect(capitalizeFirstLetter("")).toBe("");
    });
});
