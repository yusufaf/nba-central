import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';

/**
 * Shared behavior behind a picker that teleports to a fullscreen overlay
 * inside a modal Dialog (HistoricalLogoPicker, HistoricalJerseyPicker): once
 * teleported, the overlay sits outside the Dialog's own DOM subtree, so
 * reka-ui's document-level FocusScope and DismissableLayer handlers treat
 * every click and keystroke inside it as happening "outside" the dialog.
 *
 * Escape would otherwise close the parent Dialog instead of just collapsing
 * this overlay, and focus would get yanked straight back into the Dialog's
 * own subtree on every focusin/focusout, so the search input could never
 * hold focus (clicks and scrolling don't need sustained focus, so they kept
 * working - only typing didn't). Capture-phase listeners on window/document
 * get ahead of reka's own bubble-phase document listeners and stop the event
 * before reka sees it.
 */
export const useExpandablePicker = (
    expanded: Ref<boolean>,
    pickerRoot: Ref<HTMLElement | null>,
    searchField: Ref<HTMLElement | null>,
) => {
    const handleEscape = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        expanded.value = false;
    };

    const handleFocusIn = (event: FocusEvent) => {
        if (pickerRoot.value?.contains(event.target as Node)) {
            event.stopImmediatePropagation();
        }
    };

    const handleFocusOut = (event: FocusEvent) => {
        if (pickerRoot.value?.contains(event.relatedTarget as Node)) {
            event.stopImmediatePropagation();
        }
    };

    const detach = () => {
        window.removeEventListener('keydown', handleEscape, true);
        document.removeEventListener('focusin', handleFocusIn, true);
        document.removeEventListener('focusout', handleFocusOut, true);
    };

    watch(expanded, (isExpanded) => {
        if (isExpanded) {
            window.addEventListener('keydown', handleEscape, true);
            document.addEventListener('focusin', handleFocusIn, true);
            document.addEventListener('focusout', handleFocusOut, true);
            nextTick(() => searchField.value?.querySelector('input')?.focus());
        } else {
            detach();
        }
    });

    onBeforeUnmount(detach);

    return {
        collapse: () => {
            expanded.value = false;
        },
    };
};
