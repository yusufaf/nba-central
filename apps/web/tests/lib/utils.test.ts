import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
    it("merges class names", () => {
        expect(cn("px-2", "text-sm")).toBe("px-2 text-sm");
    });

    it("dedupes conflicting tailwind classes (last wins)", () => {
        expect(cn("p-2", "p-4")).toBe("p-4");
    });

    it("drops falsy/conditional values", () => {
        // eslint-disable-next-line no-constant-binary-expression -- the literal falsy operand is the input under test
        expect(cn("base", false && "hidden", null, undefined, "active")).toBe(
            "base active",
        );
    });

    it("handles array and object inputs", () => {
        expect(cn(["px-2", "py-2"], { "text-red-500": true, hidden: false })).toBe(
            "px-2 py-2 text-red-500",
        );
    });
});
