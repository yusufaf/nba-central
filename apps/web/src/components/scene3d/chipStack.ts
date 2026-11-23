// Keeps the 3D scene's name chips from covering each other. A chip's (x, y)
// is its bottom-centre in container pixels.
export interface ChipSize {
    width: number;
    height: number;
}

export const CHIP_GAP_PX = 2;

interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Nearest chips keep their place; a farther one that would cover a nearer one
// moves up above it, but no higher than `top`, where the view clips: there it
// may still overlap, which beats a name cut off. An unmeasured chip stays put
// and blocks nothing.
export const stackChips = <T extends { id: string; x: number; y: number; depth: number }>(
    chips: T[],
    sizes: ReadonlyMap<string, ChipSize>,
    gap = CHIP_GAP_PX,
    top = 0,
): T[] => {
    const placed: Box[] = [];
    const lifted = new Map<string, number>();
    for (const chip of [...chips].sort((a, b) => a.depth - b.depth)) {
        const size = sizes.get(chip.id);
        if (!size) continue;
        const box = { left: chip.x - size.width / 2, right: chip.x + size.width / 2, top: chip.y - size.height, bottom: chip.y };
        // Each move lands above a placed box and only goes up, so this ends
        // within placed.length moves.
        let blocker: Box | undefined;
        while ((blocker = placed.find((other) => overlaps(box, other)))) {
            box.bottom = blocker.top - gap;
            box.top = box.bottom - size.height;
        }
        // Never above the view, and never below where the chip started.
        box.top = Math.min(Math.max(box.top, top), chip.y - size.height);
        box.bottom = box.top + size.height;
        placed.push(box);
        if (box.top !== chip.y - size.height) lifted.set(chip.id, box.bottom);
    }
    return chips.map((chip) => (lifted.has(chip.id) ? { ...chip, y: lifted.get(chip.id)! } : chip));
};
