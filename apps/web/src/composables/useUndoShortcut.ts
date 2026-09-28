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

const isUndo = (event: KeyboardEvent, key: string) => (event.ctrlKey || event.metaKey) && !event.shiftKey && key === "z";

// Ctrl+Y is the Windows/Linux redo; on macOS Cmd+Y is the browser's History,
// so only Ctrl counts.
const isRedo = (event: KeyboardEvent, key: string) =>
    ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "z") ||
    (event.ctrlKey && !event.metaKey && !event.shiftKey && key === "y");

/**
 * Ctrl+Z (Cmd+Z on macOS) to undo, Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y to
 * redo, anywhere on the page except where the browser's own undo should win.
 */
export const useUndoShortcut = (onUndo: () => void, onRedo: () => void) => {
    useEventListener(window, "keydown", (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.isComposing || event.altKey) return;
        // Shift turns "z" into "Z", and Caps Lock does the same without it.
        const key = event.key.toLowerCase();
        const handler = isUndo(event, key) ? onUndo : isRedo(event, key) ? onRedo : undefined;
        if (!handler) return;
        if (isTextEditingTarget(event.target) || isOverlayOpen()) return;

        event.preventDefault();
        handler();
    });
};
