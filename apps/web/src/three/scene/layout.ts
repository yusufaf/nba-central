// Where each person stands for the team photo, centred on the court. A view
// narrower than TWO_ROWS_BELOW_ASPECT can't fit more than four across without
// the camera backing into the stands, so there the team stands in two rows.

const SPACING = 1.35;
const STAGGER = 0.35;
const FRONT_ROW_Z = 0.9;
const BACK_ROW_Z = -0.7;
const FRONT_ROW_SIZE = 4;

const row = (count: number, z: (i: number) => number) =>
    Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * SPACING, z: z(i) }));

export const layoutPeople = (count: number, twoRows: boolean): { x: number; z: number }[] => {
    if (!twoRows || count <= FRONT_ROW_SIZE) return row(count, (i) => (i % 2 === 0 ? 0 : -STAGGER));
    return [...row(FRONT_ROW_SIZE, () => FRONT_ROW_Z), ...row(count - FRONT_ROW_SIZE, () => BACK_ROW_Z)];
};
