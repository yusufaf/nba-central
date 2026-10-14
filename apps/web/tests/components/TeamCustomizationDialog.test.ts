import { describe, it, expect, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import TeamCustomizationDialog from "@/components/TeamBuilder/TeamCustomizationDialog.vue";
import currentTeamLogos from "@/assets/data/currentTeamLogos.json";

let wrapper: VueWrapper | undefined;

// DialogContent teleports to document.body, so everything queries the live
// document rather than the wrapper's render tree.
const mountOpen = async () => {
    wrapper = mount(TeamCustomizationDialog, {
        props: {
            showTeamCustomizationDialog: true,
            "onUpdate:showTeamCustomizationDialog": () => {},
            teamLogo: "",
        },
        global: {
            stubs: {
                HistoricalTeamCombobox: true,
                HistoricalLogoPicker: true,
                HistoricalJerseyPicker: true,
                JerseyDrawingCanvas: true,
            },
        },
        attachTo: document.body,
    });
    await nextTick();
    return wrapper;
};

const logoImages = () => Array.from(document.querySelectorAll<HTMLImageElement>("img.team-logo"));

afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
});

describe("TeamCustomizationDialog current logos", () => {
    it("lists every current team's logo on the Current tab", async () => {
        await mountOpen();

        const images = logoImages();
        expect(images).toHaveLength(30);
        expect(images).toHaveLength(currentTeamLogos.length);
        expect(images[0].getAttribute("src")).toBe(currentTeamLogos[0].logo);
        expect(images[0].getAttribute("alt")).toBe(currentTeamLogos[0].name);
    });

    it("selects a logo on click", async () => {
        const mounted = await mountOpen();

        logoImages()[2].click();
        await nextTick();

        expect(mounted.emitted("update:teamLogo")?.[0]).toEqual([currentTeamLogos[2].logo]);
    });
});
