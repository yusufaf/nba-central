// A player's height and weight from a roster snapshot. Real players carry
// BBRef's snake_case fields, custom players camelCase; either may be missing.
export interface SizeFields {
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

/**
 * A custom coach's or GM's size: their height, at the weight the body model is
 * built for (BMI 25), so only the look's girth slider makes them wider.
 */
export const staffSize = (look: { build: { heightIn: number } }): { heightInches: number; weightPounds: number } => {
    const h = look.build.heightIn;
    return { heightInches: h, weightPounds: Math.round((25 * h * h) / 703) };
};
