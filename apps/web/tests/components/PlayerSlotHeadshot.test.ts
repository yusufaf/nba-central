import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PlayerSlot from "@/components/TeamBuilder/PlayerSlot.vue";
import { resetHeadshots } from "@/composables/useHeadshots";
import { LIVE_DATA_BASE_URL } from "@/constants/liveData";
import headshots from "../fixtures/liveData/headshots.json";

// Its own file because PlayerSlot.test.ts mocks useHeadshots for every case;
// this one goes from the cached JSON to the rendered <img>.
const fetchMock = vi.fn(async () => new Response(JSON.stringify(headshots)));

beforeEach(() => {
    resetHeadshots();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
});

describe("PlayerSlot headshot from the cached JSON", () => {
    it("renders the headshot, fetching only from the CDN", async () => {
        const wrapper = mount(PlayerSlot, {
            props: {
                slotIndex: 1,
                player: {
                    id: "jamesle01",
                    fullName: "LeBron James",
                    first_name: "LeBron",
                    last_name: "James",
                    position: "SF",
                    team: { full_name: "Los Angeles Lakers", abbreviation: "LAL" },
                },
            },
            global: { stubs: { ExternalLinksMenu: true } },
        });
        await flushPromises();

        expect(wrapper.find("img").attributes("src")).toBe(`${LIVE_DATA_BASE_URL}/headshots/1966.png`);
        expect(fetchMock).toHaveBeenCalled();
        for (const [url] of fetchMock.mock.calls as unknown as [string][]) {
            expect(String(url).startsWith(LIVE_DATA_BASE_URL)).toBe(true);
        }
    });
});
