import { afterEach, describe, it, expect, vi } from "vitest";
import { effectScope } from "vue";
import { useUndoShortcut } from "@/composables/useUndoShortcut";

const scope = effectScope();
const onUndo = vi.fn();
scope.run(() => useUndoShortcut(onUndo));

afterEach(() => {
    onUndo.mockClear();
    document.body.innerHTML = "";
});

const press = (target: EventTarget, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
        key: "z",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    target.dispatchEvent(event);
    return event;
};

const mount = (html: string) => {
    document.body.innerHTML = html;
    return document.body.firstElementChild as HTMLElement;
};

describe("useUndoShortcut", () => {
    it("fires on Ctrl+Z and claims the event", () => {
        const event = press(document.body);
        expect(onUndo).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
    });

    it("fires on Cmd+Z", () => {
        press(document.body, { ctrlKey: false, metaKey: true });
        expect(onUndo).toHaveBeenCalledOnce();
    });

    it("fires with Caps Lock on", () => {
        press(document.body, { key: "Z" });
        expect(onUndo).toHaveBeenCalledOnce();
    });

    it("ignores a plain Z and the redo chords", () => {
        press(document.body, { ctrlKey: false });
        press(document.body, { shiftKey: true, key: "Z" });
        press(document.body, { altKey: true });
        expect(onUndo).not.toHaveBeenCalled();
    });

    it.each([
        ["an input", "<input />"],
        ["a textarea", "<textarea></textarea>"],
        ["a select", "<select></select>"],
        ["a contenteditable element", '<div contenteditable="true"><span>text</span></div>'],
    ])("leaves native undo alone inside %s", (_, html) => {
        const field = mount(html);
        const target = field.querySelector("span") ?? field;
        const event = press(target);
        expect(onUndo).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it("does nothing while a dialog or sheet is open", () => {
        mount('<div role="dialog" data-state="open"><button>Close</button></div>');
        press(document.body);
        expect(onUndo).not.toHaveBeenCalled();
    });

    it("works again once the dialog has closed", () => {
        mount('<div role="dialog" data-state="closed"></div>');
        press(document.body);
        expect(onUndo).toHaveBeenCalledOnce();
    });

    it("ignores events another handler already claimed", () => {
        const button = mount("<button>Swap</button>");
        button.addEventListener("keydown", (event) => event.preventDefault());
        press(button);
        expect(onUndo).not.toHaveBeenCalled();
    });

    it("stops listening when its scope is disposed", () => {
        const local = effectScope();
        const handler = vi.fn();
        local.run(() => useUndoShortcut(handler));
        local.stop();
        press(document.body);
        expect(handler).not.toHaveBeenCalled();
    });
});
