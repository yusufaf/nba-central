import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import axios from "axios";
import TeamBuilderHeader from "@/components/TeamBuilder/TeamBuilderHeader.vue";
import { useTeamBuilderPreferences } from "@/composables/useTeamBuilderPreferences";
import { settingsSync } from "@/composables/useSettingsSync";

const mountHeader = (props: Record<string, unknown>) =>
    mount(TeamBuilderHeader, {
        props: { teamUuid: null, isPublic: false, publishing: false, cardUrl: null, cardStyle: "2d", ...props },
        global: { stubs: { TeamCustomizationDialog: true, ConfirmDialog: true, PublishDialog: true } },
        attachTo: document.body,
    });

const publishDialog = (wrapper: ReturnType<typeof mountHeader>) => wrapper.findComponent({ name: "PublishDialog" });

describe("TeamBuilderHeader publish controls", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("disables Publish until the team has been saved", () => {
        const wrapper = mountHeader({});
        const button = wrapper.find('[data-testid="publish-button"]');
        expect(button.attributes("disabled")).toBeDefined();
    });

    it("asks which link preview to publish with, then emits publish with it", async () => {
        const wrapper = mountHeader({ teamUuid: "t1", cardStyle: "3d" });
        expect(publishDialog(wrapper).props("open")).toBe(false);
        await wrapper.find('[data-testid="publish-button"]').trigger("click");
        expect(publishDialog(wrapper).props()).toMatchObject({ open: true, mode: "publish", cardStyle: "3d" });
        expect(wrapper.emitted("publish")).toBeUndefined();

        publishDialog(wrapper).vm.$emit("confirm", "3d");
        expect(wrapper.emitted("publish")).toEqual([["3d"]]);
    });

    it("unpublishes straight away when public", async () => {
        const wrapper = mountHeader({ teamUuid: "t1", isPublic: true });
        await wrapper.find('[data-testid="publish-button"]').trigger("click");
        expect(wrapper.emitted("unpublish")).toHaveLength(1);
        expect(publishDialog(wrapper).props("open")).toBe(false);
    });

    it("changes the link preview from the Share menu", async () => {
        const wrapper = mountHeader({ teamUuid: "t1", isPublic: true, cardStyle: "3d" });
        const share = wrapper.find('[data-testid="share-button"]');
        await share.trigger("keydown", { key: "Enter" });
        await nextTick();
        await nextTick();
        const item = document.querySelector('[data-testid="change-preview"]') as HTMLElement;
        expect(item).not.toBeNull();
        item.click();
        await nextTick();
        expect(publishDialog(wrapper).props()).toMatchObject({ open: true, mode: "change", cardStyle: "3d" });

        publishDialog(wrapper).vm.$emit("confirm", "2d");
        expect(wrapper.emitted("publish")).toEqual([["2d"]]);
    });

    it("shows Unpublish and the share button once public", () => {
        const wrapper = mountHeader({ teamUuid: "t1", isPublic: true });
        expect(wrapper.find('[data-testid="publish-button"]').text()).toContain("Unpublish");
        expect(wrapper.find('[data-testid="share-button"]').exists()).toBe(true);
    });

    it("hides the share button while private", () => {
        const wrapper = mountHeader({ teamUuid: "t1", isPublic: false });
        expect(wrapper.find('[data-testid="share-button"]').exists()).toBe(false);
    });
});

describe("TeamBuilderHeader reset", () => {
    beforeEach(() => {
        settingsSync.stop();
        localStorage.clear();
    });

    it("asks before resetting by default", async () => {
        const wrapper = mountHeader({});
        await wrapper.find('[data-testid="reset-button"]').trigger("click");

        expect(wrapper.findComponent({ name: "ConfirmDialog" }).props("open")).toBe(true);
        expect(wrapper.emitted("reset")).toBeUndefined();
    });

    it("resets straight away with confirmations off, since a reset can be undone", async () => {
        useTeamBuilderPreferences().preferences.value.confirmDestructive = false;
        const wrapper = mountHeader({});
        await wrapper.find('[data-testid="reset-button"]').trigger("click");

        expect(wrapper.findComponent({ name: "ConfirmDialog" }).props("open")).toBe(false);
        expect(wrapper.emitted("reset")).toHaveLength(1);
    });

    it("picks up a change to the setting without remounting", async () => {
        const wrapper = mountHeader({});
        useTeamBuilderPreferences().preferences.value.confirmDestructive = false;
        await nextTick();
        await wrapper.find('[data-testid="reset-button"]').trigger("click");

        expect(wrapper.emitted("reset")).toHaveLength(1);
    });
});

describe("TeamBuilderHeader team logos", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does not request ESPN on mount (#188)", async () => {
        const get = vi.spyOn(axios, "get").mockResolvedValue({
            data: { team: { logos: [{ href: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png" }] } },
        });

        mountHeader({});
        await flushPromises();

        expect(get.mock.calls.filter(([url]) => String(url).includes("espn"))).toEqual([]);
    });
});
