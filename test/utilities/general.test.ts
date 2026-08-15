import { describe, it, expect } from "vitest";
import {
    capitalizeFirstLetter,
    toWikimediaThumbnail,
} from "../../utilities/general";

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

describe("toWikimediaThumbnail", () => {
    it("resizes an existing thumbnail to the default width", () => {
        expect(
            toWikimediaThumbnail(
                "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Amway_Center.jpg/800px-Amway_Center.jpg"
            )
        ).toBe(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Amway_Center.jpg/500px-Amway_Center.jpg"
        );
    });

    it("converts a full-size original into a thumbnail", () => {
        expect(
            toWikimediaThumbnail(
                "https://upload.wikimedia.org/wikipedia/commons/b/bc/American_Airlines_Center_August_2015.jpg"
            )
        ).toBe(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/American_Airlines_Center_August_2015.jpg/500px-American_Airlines_Center_August_2015.jpg"
        );
    });

    it("handles protocol-relative sources and strips tracking params", () => {
        expect(
            toWikimediaThumbnail(
                "//upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Ball_Arena_exterior_2022.jpg/120px-Ball_Arena_exterior_2022.jpg?utm_source=en.wikipedia.org&utm_campaign=parser"
            )
        ).toBe(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Ball_Arena_exterior_2022.jpg/500px-Ball_Arena_exterior_2022.jpg"
        );
    });

    it("preserves percent-encoded file names", () => {
        expect(
            toWikimediaThumbnail(
                "//upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Milwaukee_July_2022_022_%28Fiserv_Forum%29.jpg/120px-Milwaukee_July_2022_022_%28Fiserv_Forum%29.jpg"
            )
        ).toBe(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Milwaukee_July_2022_022_%28Fiserv_Forum%29.jpg/500px-Milwaukee_July_2022_022_%28Fiserv_Forum%29.jpg"
        );
    });

    it("rounds a non-standard requested width up to one Wikimedia serves", () => {
        expect(
            toWikimediaThumbnail(
                "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Amway_Center.jpg/800px-Amway_Center.jpg",
                300
            )
        ).toBe(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Amway_Center.jpg/330px-Amway_Center.jpg"
        );
    });

    it("leaves a non-Wikimedia-shaped path alone", () => {
        expect(toWikimediaThumbnail("https://example.com/some/photo.jpg")).toBe(
            "https://example.com/some/photo.jpg"
        );
    });
});
