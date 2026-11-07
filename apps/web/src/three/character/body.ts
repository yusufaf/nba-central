// How big each person in the 3D scene is. Real players carry BBRef's
// snake_case sizes, custom ones camelCase; either can be missing.

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

interface SizeFields {
    height_feet?: number | null;
    height_inches?: number | null;
    weight_pounds?: number | null;
    heightFeet?: number | null;
    heightInches?: number | null;
    weightPounds?: number | null;
}

export const snapshotSize = (player: SizeFields): { heightInches: number | null; weightPounds: number | null } => {
    const feet = player.height_feet ?? player.heightFeet ?? null;
    const inches = player.height_inches ?? player.heightInches ?? 0;
    return {
        heightInches: feet ? feet * 12 + inches : null,
        weightPounds: player.weight_pounds ?? player.weightPounds ?? null,
    };
};

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
