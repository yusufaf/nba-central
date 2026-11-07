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
