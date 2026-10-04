import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ShareCard from "@/components/TeamBuilder/share/ShareCard.vue";

const props = {
    title: "Sharers",
    city: "Chicago",
    country: "USA",
    logoUrl: "https://cdn.example/logo.png",
    jerseyUrl: "",
    username: "yusuf",
    starters: [
        { fullName: "Michael Jordan", position: "SG", rating: 99 },
        { fullName: "Scottie Pippen", position: "SF", rating: 95 },
        { fullName: "Unrated Guy", position: "C" },
    ],
};

const court = {
    version: 1 as const,
    wood: "maple" as const,
    paint: "#4b2a7b",
    apron: "#4b2a7b",
    lines: "#ffffff",
    centerLogo: "team" as const,
    baselineText: "Harbor Pavilion",
    sidelineText: "Seattle",
};

describe("ShareCard", () => {
    it("renders title, owner, starters and the average of rated starters", () => {
        const wrapper = mount(ShareCard, { props });
        expect(wrapper.text()).toContain("Sharers");
        expect(wrapper.text()).toContain("by yusuf");
        expect(wrapper.text()).toContain("Michael Jordan");
        expect(wrapper.text()).toContain("97"); // (99 + 95) / 2
    });

    // The card is a published image, so it keeps the dark tokens whatever
    // theme the person publishing it uses.
    it("keeps one dark look in either theme", () => {
        const wrapper = mount(ShareCard, { props });
        expect(wrapper.classes()).toContain("dark");
    });

    it("loads images anonymously so the canvas export is not tainted", () => {
        const wrapper = mount(ShareCard, { props });
        const img = wrapper.find("img");
        expect(img.attributes("crossorigin")).toBe("anonymous");
    });

    it("swaps a failed logo for a monogram", async () => {
        const wrapper = mount(ShareCard, { props });
        await wrapper.find("img").trigger("error");
        expect(wrapper.find("img").exists()).toBe(false);
        expect(wrapper.text()).toContain("S"); // first letter of the title
    });

    it("looks the same as before without a court", () => {
        const wrapper = mount(ShareCard, { props: { ...props, arenaName: "United Center" } });
        expect(wrapper.find("svg").exists()).toBe(false);
        expect(wrapper.find('[data-testid="share-court"]').exists()).toBe(false);
        expect(wrapper.text()).not.toContain("Home court");
    });

    it("draws the flat court under a scrim, names the home court, and stays dark", () => {
        const wrapper = mount(ShareCard, {
            props: { ...props, court, courtLogoUrl: "https://cdn.example/logo.png", arenaName: "Harbor Pavilion" },
        });
        const layer = wrapper.find('[data-testid="share-court"]');
        expect(layer.find("svg").exists()).toBe(true);
        expect(layer.find("image").attributes("href")).toBe("https://cdn.example/logo.png");
        expect(wrapper.find('[data-testid="share-scrim"]').exists()).toBe(true);
        expect(wrapper.text()).toContain("Home court: Harbor Pavilion");
        expect(wrapper.classes()).toContain("dark");
    });

    it("draws the court's drawing on the card, and nothing extra without one", () => {
        const withDrawing = mount(ShareCard, { props: { ...props, court, courtDrawingUrl: "https://cdn.example/arenas/a1/drawing-1.png" } });
        expect(withDrawing.find('[data-testid="share-court"] [data-part="drawing"]').attributes("href")).toBe("https://cdn.example/arenas/a1/drawing-1.png");
        const without = mount(ShareCard, { props: { ...props, court } });
        expect(without.find('[data-part="drawing"]').exists()).toBe(false);
    });
});
