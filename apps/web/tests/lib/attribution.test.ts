import { describe, it, expect, vi, beforeEach } from "vitest";

const load = async () => await import("@/lib/attribution");
const ORIGIN = "https://nba-central.example";

beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
});

describe("resolveSource", () => {
    it("lets utm_source beat ref and the referrer", async () => {
        const { resolveSource } = await load();
        expect(
            resolveSource({
                search: "?utm_source=Newsletter&ref=x",
                referrer: "https://www.reddit.com/",
                origin: ORIGIN,
            }),
        ).toBe("newsletter");
    });

    it("falls back to ref, skipping an empty utm_source", async () => {
        const { resolveSource } = await load();
        expect(resolveSource({ search: "?ref=twitter", referrer: "", origin: ORIGIN })).toBe("twitter");
        expect(resolveSource({ search: "?utm_source=&ref=x", referrer: "", origin: ORIGIN })).toBe("x");
    });

    it("collapses personal or free-text values to other", async () => {
        const { resolveSource } = await load();
        for (const search of ["?ref=me%40mail.com", `?ref=${"a".repeat(65)}`, "?utm_source=a%20b"]) {
            expect(resolveSource({ search, referrer: "", origin: ORIGIN })).toBe("other");
        }
    });

    it("reduces a cross-origin referrer to its bare hostname", async () => {
        const { resolveSource } = await load();
        expect(
            resolveSource({
                search: "",
                referrer: "https://www.reddit.com/r/nba/comments/abc?user=me",
                origin: ORIGIN,
            }),
        ).toBe("reddit.com");
    });

    it("treats same-origin, empty and unparseable referrers as direct", async () => {
        const { resolveSource } = await load();
        for (const referrer of [`${ORIGIN}/teams`, "", "not a url"]) {
            expect(resolveSource({ search: "", referrer, origin: ORIGIN })).toBe("direct");
        }
    });
});

describe("captureLandingSource", () => {
    it("keeps the first touch across a reload", async () => {
        const first = await load();
        expect(first.captureLandingSource({ search: "?utm_source=x", origin: ORIGIN }, "")).toBe("x");

        vi.resetModules();
        const second = await load();
        expect(
            second.captureLandingSource({ search: "", origin: ORIGIN }, "https://auth.yusufaf.dev/"),
        ).toBe("x");
    });

    it("still resolves when storage is blocked", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        const { captureLandingSource, landingSource } = await load();
        expect(captureLandingSource({ search: "?ref=blocked", origin: ORIGIN }, "")).toBe("blocked");
        expect(landingSource()).toBe("blocked");
    });
});

describe("landingSource", () => {
    it("resolves from the page when nothing was captured", async () => {
        const { landingSource } = await load();
        expect(landingSource()).toBe("direct");
    });
});
