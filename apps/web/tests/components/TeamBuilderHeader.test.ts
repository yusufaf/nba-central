import { describe, it, expect, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import TeamBuilderHeader from "@/components/TeamBuilder/TeamBuilderHeader.vue";
import { useTeamBuilderPreferences } from "@/composables/useTeamBuilderPreferences";
import { settingsSync } from "@/composables/useSettingsSync";

const mountHeader = (props: Record<string, unknown>) =>
    mount(TeamBuilderHeader, {
        props: { teamUuid: null, isPublic: false, publishing: false, cardUrl: null, ...props },
        global: { stubs: { TeamCustomizationDialog: true, ConfirmDialog: true } },
    });

describe("TeamBuilderHeader publish controls", () => {
    it("disables Publish until the team has been saved", () => {
        const wrapper = mountHeader({});
        const button = wrapper.find('[data-testid="publish-button"]');
        expect(button.attributes("disabled")).toBeDefined();
    });

    it("emits togglePublish when enabled and clicked", async () => {
        const wrapper = mountHeader({ teamUuid: "t1" });
        await wrapper.find('[data-testid="publish-button"]').trigger("click");
        expect(wrapper.emitted("togglePublish")).toHaveLength(1);
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
