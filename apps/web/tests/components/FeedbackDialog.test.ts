import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";

const send = vi.hoisted(() => vi.fn());
vi.mock("@/network/api", () => ({ feedbackApi: { send } }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));

const isAuthenticated = vi.hoisted(() => ({ value: true }));
vi.mock("@logto/vue", () => ({
    useLogto: () => ({ isAuthenticated: ref(isAuthenticated.value) }),
}));

import FeedbackDialog from "@/components/FeedbackDialog.vue";

const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
});

// DialogContent teleports to document.body, so everything queries the live
// document rather than the wrapper's render tree.
const mountOpen = () =>
    mount(FeedbackDialog, {
        props: { open: true, "onUpdate:open": () => {} },
        global: { plugins: [router] },
        attachTo: document.body,
    });

const textarea = () => document.querySelector("textarea") as HTMLTextAreaElement | null;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const button = (label: string) =>
    [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement;

const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
};

describe("FeedbackDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isAuthenticated.value = true;
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("asks a signed-out visitor to log in instead of showing the form", async () => {
        isAuthenticated.value = false;
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        expect(textarea()).toBeNull();
        expect(document.body.textContent).toContain("Log in");
        expect(document.querySelector('a[href="/login"]')).not.toBeNull();

        wrapper.unmount();
    });

    it("keeps Send disabled until there is a message", async () => {
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        expect(button("Send").disabled).toBe(true);
        await type(textarea()!, "   ");
        expect(button("Send").disabled).toBe(true);
        await type(textarea()!, "The jersey picker is great");
        expect(button("Send").disabled).toBe(false);

        wrapper.unmount();
    });

    it("sends the trimmed message, omits a blank subject, toasts, and closes", async () => {
        send.mockResolvedValue({ success: true, data: { messageId: "ses-1" } });
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        await type(textarea()!, "  Please add a dark mode toggle  ");
        await type(input("feedback-subject"), "   ");
        button("Send").click();
        await vi.waitFor(() => expect(send).toHaveBeenCalled());
        await nextTick();

        expect(send).toHaveBeenCalledWith({ message: "Please add a dark mode toggle" });
        expect(toast.success).toHaveBeenCalled();
        expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);

        wrapper.unmount();
    });

    it("includes the subject when one is typed", async () => {
        send.mockResolvedValue({ success: true, data: { messageId: "ses-2" } });
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        await type(textarea()!, "Bug: scores page overflows");
        await type(input("feedback-subject"), " Scores ");
        button("Send").click();
        await vi.waitFor(() => expect(send).toHaveBeenCalled());

        expect(send).toHaveBeenCalledWith({
            message: "Bug: scores page overflows",
            subject: "Scores",
        });

        wrapper.unmount();
    });

    it("surfaces an API failure and keeps the dialog and text", async () => {
        send.mockResolvedValue({ success: false, error: "message must be 5000 characters or fewer" });
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        await type(textarea()!, "Something");
        button("Send").click();
        await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
        await nextTick();

        expect(toast.error).toHaveBeenCalledWith("message must be 5000 characters or fewer");
        expect(wrapper.emitted("update:open") ?? []).not.toContainEqual([false]);
        expect(textarea()!.value).toBe("Something");
        expect(button("Send").disabled).toBe(false);

        wrapper.unmount();
    });

    it("ignores a response that arrives after the dialog was closed", async () => {
        let resolveSend!: (value: unknown) => void;
        send.mockReturnValue(new Promise((resolve) => { resolveSend = resolve; }));
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        await type(textarea()!, "First draft");
        button("Send").click();
        await vi.waitFor(() => expect(send).toHaveBeenCalled());

        // Escape / overlay close while the request is in flight.
        await wrapper.setProps({ open: false });
        await nextTick();
        resolveSend({ success: true, data: { messageId: "late" } });
        await nextTick();
        await nextTick();

        expect(toast.success).not.toHaveBeenCalled();
        expect(wrapper.emitted("update:open") ?? []).not.toContainEqual([false]);

        wrapper.unmount();
    });

    it("closes the dialog when the signed-out Log in link is followed", async () => {
        isAuthenticated.value = false;
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        (document.querySelector('a[href="/login"]') as HTMLAnchorElement).click();
        await nextTick();

        expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);

        wrapper.unmount();
    });

    it("surfaces a thrown request error", async () => {
        send.mockRejectedValue(new Error("Network Error"));
        const wrapper = mountOpen();
        await nextTick();
        await nextTick();

        await type(textarea()!, "Something");
        button("Send").click();
        await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());

        expect(toast.error).toHaveBeenCalledWith("Network Error");
        expect(toast.success).not.toHaveBeenCalled();

        wrapper.unmount();
    });
});
