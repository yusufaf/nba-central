import { useEventListener } from "@vueuse/core";

// Text fields keep their own undo history; stealing Ctrl+Z there would undo a
// roster change while the user is fixing a typo in the team name.
const isTextEditingTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null);

// reka-ui renders dialogs, sheets and popovers as role="dialog" with a
// data-state. The builder behind an open one isn't what the user is looking at.
const isOverlayOpen = () =>
    document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']") !== null;

/**
 * Ctrl+Z (Cmd+Z on macOS) anywhere on the page, except where the browser's
 * own undo should win. Shift+Ctrl+Z is left alone for a future redo.
 */
export const useUndoShortcut = (onUndo: () => void) => {
    useEventListener(window, "keydown", (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.isComposing) return;
        if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
        if (event.key.toLowerCase() !== "z") return;
        if (isTextEditingTarget(event.target) || isOverlayOpen()) return;

        event.preventDefault();
        onUndo();
    });
};
