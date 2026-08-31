import { describe, it, expect, vi } from "vitest";
import {
    swapMapEntries,
    swapSetMembers,
    useRosterDragDrop,
} from "@/composables/useRosterDragDrop";

describe("swapMapEntries", () => {
    it("swaps two occupied keys", () => {
        const map = new Map([
            [6, "Duckworth"],
            [7, "Lawson"],
        ]);
        swapMapEntries(map, 6, 7);
        expect(map.get(6)).toBe("Lawson");
        expect(map.get(7)).toBe("Duckworth");
    });

    it("moves into an empty key without leaving the source behind", () => {
        const map = new Map([[6, "Duckworth"]]);
        swapMapEntries(map, 6, 9);
        expect(map.has(6)).toBe(false);
        expect(map.get(9)).toBe("Duckworth");
    });

    it("moves out of an empty key in the other direction", () => {
        const map = new Map([[9, "Duckworth"]]);
        swapMapEntries(map, 6, 9);
        expect(map.get(6)).toBe("Duckworth");
        expect(map.has(9)).toBe(false);
    });

    it("leaves the map untouched for identical keys", () => {
        const map = new Map([[6, "Duckworth"]]);
        swapMapEntries(map, 6, 6);
        expect([...map.entries()]).toEqual([[6, "Duckworth"]]);
    });

    it("keeps falsy values instead of treating them as absent", () => {
        const map = new Map([
            [6, false],
            [7, true],
        ]);
        swapMapEntries(map, 6, 7);
        expect(map.get(6)).toBe(true);
        expect(map.get(7)).toBe(false);
    });
});

describe("swapSetMembers", () => {
    it("moves membership from one slot to the other", () => {
        const set = new Set([6]);
        swapSetMembers(set, 6, 7);
        expect(set.has(6)).toBe(false);
        expect(set.has(7)).toBe(true);
    });

    it("leaves both members when both are present", () => {
        const set = new Set([6, 7]);
        swapSetMembers(set, 6, 7);
        expect([...set].sort()).toEqual([6, 7]);
    });

    it("leaves both absent when neither is present", () => {
        const set = new Set<number>();
        swapSetMembers(set, 6, 7);
        expect(set.size).toBe(0);
    });
});

// Slots 6 and 7 hold players; 9 is empty. Mirrors the bench in the UI.
const setup = (occupied = new Set([6, 7]), pending = new Set<number>()) => {
    const onSwap = vi.fn();
    const dragDrop = useRosterDragDrop({
        onSwap,
        isOccupied: (slot) => occupied.has(slot),
        isPending: (slot) => pending.has(slot),
        describeSlot: (slot) => `slot ${slot}`,
    });
    return { onSwap, ...dragDrop };
};

const dragEvent = () => ({
    preventDefault: vi.fn(),
    dataTransfer: { effectAllowed: "", dropEffect: "", setData: vi.fn() },
}) as unknown as DragEvent & { preventDefault: ReturnType<typeof vi.fn> };

describe("useRosterDragDrop - pointer drag", () => {
    it("swaps the source and target slots on drop", () => {
        const { onSwap, startDrag, dropOnSlot, draggingSlot } = setup();

        startDrag(6, dragEvent());
        expect(draggingSlot.value).toBe(6);

        dropOnSlot(7, dragEvent());
        expect(onSwap).toHaveBeenCalledWith(6, 7);
        expect(draggingSlot.value).toBeNull();
    });

    it("refuses to start a drag from an empty slot", () => {
        const { startDrag, draggingSlot } = setup();
        const event = dragEvent();

        startDrag(9, event);
        expect(draggingSlot.value).toBeNull();
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it("moves a player into an empty slot", () => {
        const { onSwap, startDrag, dropOnSlot } = setup();

        startDrag(6, dragEvent());
        dropOnSlot(9, dragEvent());
        expect(onSwap).toHaveBeenCalledWith(6, 9);
    });

    it("does nothing when a card is dropped on itself", () => {
        const { onSwap, startDrag, dropOnSlot } = setup();

        startDrag(6, dragEvent());
        dropOnSlot(6, dragEvent());
        expect(onSwap).not.toHaveBeenCalled();
    });

    it("tracks and clears the drop target", () => {
        const { startDrag, dragOverSlot, leaveSlot, dropTargetSlot } = setup();

        startDrag(6, dragEvent());
        dragOverSlot(7, dragEvent());
        expect(dropTargetSlot.value).toBe(7);

        // A dragleave from a slot that isn't the current target must not clear it.
        leaveSlot(9);
        expect(dropTargetSlot.value).toBe(7);

        leaveSlot(7);
        expect(dropTargetSlot.value).toBeNull();
    });

    it("allows the drop by preventing the dragover default", () => {
        const { startDrag, dragOverSlot } = setup();
        const event = dragEvent();

        startDrag(6, dragEvent());
        dragOverSlot(7, event);
        expect(event.preventDefault).toHaveBeenCalled();
    });
});

describe("useRosterDragDrop - keyboard pickup", () => {
    it("picks up then swaps on the second slot", () => {
        const { onSwap, togglePickup, pickedUpSlot, liveMessage } = setup();

        togglePickup(6);
        expect(pickedUpSlot.value).toBe(6);
        expect(liveMessage.value).toContain("slot 6");

        togglePickup(7);
        expect(onSwap).toHaveBeenCalledWith(6, 7);
        expect(pickedUpSlot.value).toBeNull();
        expect(liveMessage.value).toBe("Swapped slot 6 with slot 7.");
    });

    it("puts the card back when the same slot is pressed twice", () => {
        const { onSwap, togglePickup, pickedUpSlot } = setup();

        togglePickup(6);
        togglePickup(6);
        expect(onSwap).not.toHaveBeenCalled();
        expect(pickedUpSlot.value).toBeNull();
    });

    it("ignores a pickup on an empty slot", () => {
        const { togglePickup, pickedUpSlot } = setup();

        togglePickup(9);
        expect(pickedUpSlot.value).toBeNull();
    });

    it("cancels a pickup without swapping", () => {
        const { onSwap, togglePickup, cancelPickup, pickedUpSlot } = setup();

        togglePickup(6);
        cancelPickup();
        expect(pickedUpSlot.value).toBeNull();
        expect(onSwap).not.toHaveBeenCalled();
    });

    it("drops a keyboard pickup when a pointer drag takes over", () => {
        const { togglePickup, startDrag, pickedUpSlot } = setup();

        togglePickup(6);
        startDrag(7, dragEvent());
        expect(pickedUpSlot.value).toBeNull();
    });
});

// A pending slot renders empty but already has a player on the way. Anything
// moved into it would be overwritten the moment that fetch lands.
describe("useRosterDragDrop - pending slots", () => {
    it("refuses a pointer drop onto a pending slot", () => {
        const { onSwap, startDrag, dropOnSlot } = setup(new Set([6]), new Set([9]));

        startDrag(6, dragEvent());
        dropOnSlot(9, dragEvent());
        expect(onSwap).not.toHaveBeenCalled();
    });

    it("does not offer a pending slot as a drop target", () => {
        const { startDrag, dragOverSlot, dropTargetSlot } = setup(
            new Set([6]),
            new Set([9]),
        );
        const event = dragEvent();

        startDrag(6, dragEvent());
        dragOverSlot(9, event);
        expect(dropTargetSlot.value).toBeNull();
        // Leaving the default in place is what makes the browser refuse the drop.
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("keeps a keyboard pickup held when the target slot is pending", () => {
        const { onSwap, togglePickup, pickedUpSlot, liveMessage } = setup(
            new Set([6]),
            new Set([9]),
        );

        togglePickup(6);
        togglePickup(9);
        expect(onSwap).not.toHaveBeenCalled();
        expect(pickedUpSlot.value).toBe(6);
        expect(liveMessage.value).toContain("still loading");
    });

    it("still allows moves between slots that are not pending", () => {
        const { onSwap, startDrag, dropOnSlot } = setup(new Set([6]), new Set([9]));

        startDrag(6, dragEvent());
        dropOnSlot(7, dragEvent());
        expect(onSwap).toHaveBeenCalledWith(6, 7);
    });
});
