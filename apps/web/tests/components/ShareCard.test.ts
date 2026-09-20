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

describe("ShareCard", () => {
    it("renders title, owner, starters and the average of rated starters", () => {
        const wrapper = mount(ShareCard, { props });
        expect(wrapper.text()).toContain("Sharers");
        expect(wrapper.text()).toContain("by yusuf");
        expect(wrapper.text()).toContain("Michael Jordan");
        expect(wrapper.text()).toContain("97"); // (99 + 95) / 2
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
});
