import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TeamBuilderHeader from "@/components/TeamBuilder/TeamBuilderHeader.vue";

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
