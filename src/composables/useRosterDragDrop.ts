import { ref } from 'vue';

/**
 * Swap the values of two keys, treating "key absent" as a real value so that
 * moving a player into an empty slot leaves the source slot empty rather than
 * duplicating the entry.
 */
export const swapMapEntries = <K, V>(map: Map<K, V>, a: K, b: K): void => {
    if (a === b) return;

    const hasA = map.has(a);
    const hasB = map.has(b);
    const valueA = map.get(a);
    const valueB = map.get(b);

    if (hasB) map.set(a, valueB as V);
    else map.delete(a);

    if (hasA) map.set(b, valueA as V);
    else map.delete(b);
};

/** Same idea for a Set: membership follows the card to its new slot. */
export const swapSetMembers = <T>(set: Set<T>, a: T, b: T): void => {
    if (a === b) return;

    const hasA = set.has(a);
    const hasB = set.has(b);

    if (hasB) set.add(a);
    else set.delete(a);

    if (hasA) set.add(b);
    else set.delete(b);
};

interface RosterDragDropOptions {
    /** Performs the actual state swap. Only called for a valid, non-identical pair. */
    onSwap: (from: number, to: number) => void;
    /** True when the slot holds a player - empty slots can be dropped on but not dragged. */
    isOccupied: (slot: number) => boolean;
    /** Human-readable slot description used for the aria-live announcements. */
    describeSlot: (slot: number) => string;
}

export function useRosterDragDrop(options: RosterDragDropOptions) {
    const { onSwap, isOccupied, describeSlot } = options;

    // The slot the pointer drag started from. This - not dataTransfer - is the
    // source of truth, because getData() is unreadable during dragover.
    const draggingSlot = ref<number | null>(null);
    const dropTargetSlot = ref<number | null>(null);
    // The slot "held" by the keyboard flow, which is a separate gesture from a
    // pointer drag and can outlive any single event.
    const pickedUpSlot = ref<number | null>(null);
    const liveMessage = ref<string>('');

    // Two empty slots trading places is a no-op, so don't bother the callback.
    const applySwap = (from: number, to: number) => {
        if (from === to) return false;
        if (!isOccupied(from) && !isOccupied(to)) return false;
        onSwap(from, to);
        return true;
    };

    const startDrag = (slot: number, event: DragEvent) => {
        if (!isOccupied(slot)) {
            event.preventDefault();
            return;
        }

        draggingSlot.value = slot;
        pickedUpSlot.value = null;

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(slot));
        }
    };

    const endDrag = () => {
        draggingSlot.value = null;
        dropTargetSlot.value = null;
    };

    const dragOverSlot = (slot: number, event: DragEvent) => {
        if (draggingSlot.value === null || draggingSlot.value === slot) return;

        // Without preventDefault the browser refuses the drop entirely.
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        dropTargetSlot.value = slot;
    };

    // Guarded on identity because dragleave also fires when moving between a
    // card's own children, which would otherwise clear a still-valid target.
    const leaveSlot = (slot: number) => {
        if (dropTargetSlot.value === slot) dropTargetSlot.value = null;
    };

    const dropOnSlot = (slot: number, event: DragEvent) => {
        event.preventDefault();

        const from = draggingSlot.value;
        endDrag();

        if (from === null) return;
        if (applySwap(from, slot)) {
            liveMessage.value = `Moved ${describeSlot(slot)}.`;
        }
    };

    /**
     * Keyboard equivalent of a drag: first press picks a card up, the next press
     * on a different slot completes the swap, and a press on the same slot puts
     * it back down.
     */
    const togglePickup = (slot: number) => {
        const held = pickedUpSlot.value;

        if (held === null) {
            if (!isOccupied(slot)) return;
            pickedUpSlot.value = slot;
            liveMessage.value = `${describeSlot(slot)} picked up. Move to another slot and press Enter to swap, or press Escape to cancel.`;
            return;
        }

        if (held === slot) {
            pickedUpSlot.value = null;
            liveMessage.value = `${describeSlot(slot)} put back.`;
            return;
        }

        const target = describeSlot(slot);
        const source = describeSlot(held);
        pickedUpSlot.value = null;

        if (applySwap(held, slot)) {
            liveMessage.value = `Swapped ${source} with ${target}.`;
        }
    };

    const cancelPickup = () => {
        if (pickedUpSlot.value === null) return;
        liveMessage.value = `${describeSlot(pickedUpSlot.value)} put back.`;
        pickedUpSlot.value = null;
    };

    return {
        draggingSlot,
        dropTargetSlot,
        pickedUpSlot,
        liveMessage,
        startDrag,
        endDrag,
        dragOverSlot,
        leaveSlot,
        dropOnSlot,
        togglePickup,
        cancelPickup,
    };
}
