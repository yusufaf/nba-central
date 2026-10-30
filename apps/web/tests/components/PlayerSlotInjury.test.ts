import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import PlayerSlot from "@/components/TeamBuilder/PlayerSlot.vue";
import { resetHeadshots } from "@/composables/useHeadshots";
import { resetInjuries } from "@/composables/useInjuries";
import { LIVE_DATA_BASE_URL } from "@/constants/liveData";
import headshots from "../fixtures/liveData/headshots.json";
import injuries from "../fixtures/liveData/injuries.json";

// The two live files come from the CDN; anything else (site.api.espn.com
// included) is refused, so a badge can only come from the cached file.
const fetchMock = vi.fn(async (url: string) => {
    const href = String(url);
    if (href === `${LIVE_DATA_BASE_URL}/headshots.json`) return new Response(JSON.stringify(headshots));
    if (href === `${LIVE_DATA_BASE_URL}/injuries.json`) return new Response(JSON.stringify(injuries));
    throw new TypeError(`blocked: ${href}`);
});

const player = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    fullName: "Some Player",
    first_name: "Some",
    last_name: "Player",
    position: "SF",
    team: { full_name: "Los Angeles Lakers", abbreviation: "LAL" },
    ...extra,
});

const mountCard = async (props: Record<string, unknown>) => {
    const wrapper = mount(PlayerSlot, {
        props: { slotIndex: 1, ...props },
        global: { stubs: { ExternalLinksMenu: true } },
    });
    await flushPromises();
    return wrapper;
};

// A card left mounted would re-render when the next test resets the cache,
// and look injuries up again.
enableAutoUnmount(afterEach);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-26T13:00:00Z") });
    resetHeadshots();
    resetInjuries();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    resetInjuries();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockClear();
});

describe("PlayerSlot injury status from the cached JSON", () => {
    it("shows the cached injury status, fetching only from the CDN", async () => {
        const wrapper = await mountCard({ player: player("jamesle01") });

        const badge = wrapper.get(".injury-badge");
        expect(badge.text()).toBe("Injury status: Out");
        expect(badge.get(".sr-only").text()).toBe("Injury status:");
        expect(badge.attributes("title")).toBe("James (sciatica) won't play Monday against the Kings.");
        expect(badge.classes()).toContain("bg-destructive");
        expect(fetchMock).toHaveBeenCalled();
        for (const [url] of fetchMock.mock.calls as unknown as [string][]) {
            expect(String(url).startsWith(LIVE_DATA_BASE_URL)).toBe(true);
        }
    });

    it("gives a day-to-day player the warning badge", async () => {
        const wrapper = await mountCard({ player: player("doncilu01") });
        expect(wrapper.get(".injury-badge").classes()).toContain("bg-warning");
    });

    it("shows no badge for a healthy player", async () => {
        const wrapper = await mountCard({ player: player("hardyja02") });
        expect(wrapper.find(".injury-badge").exists()).toBe(false);
    });

    it("shows no badge for a custom player and looks nothing up", async () => {
        const wrapper = await mountCard({ player: player("jamesle01", { isCustom: true }) });
        expect(wrapper.find(".injury-badge").exists()).toBe(false);
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/injuries.json"))).toBe(false);
    });

    it("shows the comment and when it was updated on the card back", async () => {
        const wrapper = await mountCard({ player: player("jamesle01"), isFlipped: true });
        const notice = wrapper.get(".injury-notice");
        expect(notice.text()).toContain("James (sciatica) won't play Monday against the Kings.");
        expect(notice.text()).toContain("Updated");
        expect(notice.get(".injury-badge").text()).toBe("Out");
    });
});
