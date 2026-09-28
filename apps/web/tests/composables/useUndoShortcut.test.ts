import { afterEach, describe, it, expect, vi } from "vitest";
import { effectScope } from "vue";
import { useUndoShortcut } from "@/composables/useUndoShortcut";

const scope = effectScope();
const onUndo = vi.fn();
const onRedo = vi.fn();
scope.run(() => useUndoShortcut(onUndo, onRedo));

afterEach(() => {
    onUndo.mockClear();
    onRedo.mockClear();
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

    it("ignores a plain Z and Alt chords", () => {
        press(document.body, { ctrlKey: false });
        press(document.body, { altKey: true });
        press(document.body, { altKey: true, shiftKey: true, key: "Z" });
        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
    });

    it.each([
        ["Ctrl+Shift+Z", { shiftKey: true, key: "Z" }],
        ["Cmd+Shift+Z", { ctrlKey: false, metaKey: true, shiftKey: true, key: "Z" }],
        ["Ctrl+Shift+Z with Caps Lock on", { shiftKey: true, key: "z" }],
        ["Ctrl+Y", { key: "y" }],
    ])("redoes on %s and claims the event", (_, init) => {
        const event = press(document.body, init);
        expect(onRedo).toHaveBeenCalledOnce();
        expect(onUndo).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
    });

    // Cmd+Y is the browser's History on macOS, and Ctrl+Shift+Y isn't a redo
    // chord anywhere.
    it("leaves Cmd+Y and Ctrl+Shift+Y to the browser", () => {
        const cmdY = press(document.body, { ctrlKey: false, metaKey: true, key: "y" });
        const ctrlShiftY = press(document.body, { shiftKey: true, key: "Y" });
        expect(onRedo).not.toHaveBeenCalled();
        expect(cmdY.defaultPrevented).toBe(false);
        expect(ctrlShiftY.defaultPrevented).toBe(false);
    });

    const chords: [string, KeyboardEventInit][] = [
        ["Ctrl+Z", {}],
        ["Ctrl+Shift+Z", { shiftKey: true, key: "Z" }],
        ["Cmd+Shift+Z", { ctrlKey: false, metaKey: true, shiftKey: true, key: "Z" }],
        ["Ctrl+Y", { key: "y" }],
    ];
    const fields = [
        ["an input", "<input />"],
        ["a textarea", "<textarea></textarea>"],
        ["a select", "<select></select>"],
        ["a contenteditable element", '<div contenteditable="true"><span>text</span></div>'],
    ];

    it.each(chords.flatMap(([chord, init]) => fields.map(([where, html]) => [chord, where, html, init] as const)))(
        "leaves native %s alone inside %s",
        (_, __, html, init) => {
            const field = mount(html);
            const target = field.querySelector("span") ?? field;
            const event = press(target, init);
            expect(onUndo).not.toHaveBeenCalled();
            expect(onRedo).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(false);
        },
    );

    it.each(chords)("does nothing on %s while a dialog or sheet is open", (_, init) => {
        mount('<div role="dialog" data-state="open"><button>Close</button></div>');
        press(document.body, init);
        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
    });

    it("does nothing while an alert dialog is open", () => {
        mount('<div role="alertdialog" data-state="open"></div>');
        press(document.body, { shiftKey: true, key: "Z" });
        expect(onRedo).not.toHaveBeenCalled();
    });

    it("works again once the dialog has closed", () => {
        mount('<div role="dialog" data-state="closed"></div>');
        press(document.body);
        press(document.body, { key: "y" });
        expect(onUndo).toHaveBeenCalledOnce();
        expect(onRedo).toHaveBeenCalledOnce();
    });

    it("skips IME composition", () => {
        press(document.body, { isComposing: true });
        press(document.body, { isComposing: true, key: "y" });
        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
    });

    it("ignores events another handler already claimed", () => {
        const button = mount("<button>Swap</button>");
        button.addEventListener("keydown", (event) => event.preventDefault());
        press(button);
        press(button, { key: "y" });
        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
    });

    it("stops listening when its scope is disposed", () => {
        const local = effectScope();
        const handler = vi.fn();
        local.run(() => useUndoShortcut(handler, handler));
        local.stop();
        press(document.body);
        press(document.body, { key: "y" });
        expect(handler).not.toHaveBeenCalled();
    });
});
