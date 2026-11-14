// How big each person in the 3D scene is. Real players carry BBRef's
// snake_case sizes, custom ones camelCase; either can be missing.
import type { PersonAppearance } from '@/constants/appearance';
import type { BodyShape } from './reshape';

export type Role = 'player' | 'coach' | 'gm';

export interface BodySize {
    heightInches: number;
    weightPounds: number;
}

type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

// Rough modern medians, used only when a size is missing.
export const POSITION_MEDIANS: Record<Position, BodySize> = {
    PG: { heightInches: 74, weightPounds: 190 },
    SG: { heightInches: 77, weightPounds: 205 },
    SF: { heightInches: 79, weightPounds: 220 },
    PF: { heightInches: 81, weightPounds: 235 },
    C: { heightInches: 83, weightPounds: 255 },
};

// Coaches and GMs have no size data at all.
export const STAFF_DEFAULT: BodySize = { heightInches: 72, weightPounds: 200 };

// Lives outside src/three so the public page can use it without the 3D chunk.
export { snapshotSize } from '@/utils/playerSize';

const isPosition = (value: string | undefined): value is Position => !!value && value in POSITION_MEDIANS;

export const bodySize = (input: {
    role: Role;
    position?: string;
    heightInches: number | null;
    weightPounds: number | null;
}): BodySize => {
    const fallback = input.role !== 'player' ? STAFF_DEFAULT : POSITION_MEDIANS[isPosition(input.position) ? input.position : 'SF'];
    return {
        heightInches: input.heightInches ?? fallback.heightInches,
        weightPounds: input.weightPounds ?? fallback.weightPounds,
    };
};

// Body mass index around 25 is the model as built; heavier is wider.
export const girthFor = ({ heightInches, weightPounds }: BodySize): number => {
    const bmi = (703 * weightPounds) / (heightInches * heightInches);
    return Math.min(1.3, Math.max(0.86, 1 + (bmi - 25) * 0.035));
};

const WINGSPAN = 1.03;

/**
 * The reshape for a body: girth from the weight, then a custom look's build
 * sliders (-1..1) on top. A zero build is the figurine shape, so real people
 * don't change.
 */
export const shapeFor = (size: BodySize, build?: PersonAppearance['build'] | null): BodyShape => {
    const { girth = 0, shoulders = 0, wingspan = 0 } = build ?? {};
    return {
        girth: Math.min(1.45, Math.max(0.8, girthFor(size) * (1 + 0.15 * girth))),
        shoulders: 1 + 0.15 * shoulders,
        wingspan: WINGSPAN * (1 + 0.05 * wingspan),
    };
};
