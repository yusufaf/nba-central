// Mirrored from apps/cdk/models/custom-entities.ts; apps/cdk's
// test/utilities/appearance.test.ts fails if the copies drift.
// Keep this file free of imports: that test loads it outside Vite.

export const APPEARANCE_FRAMES = ['m', 'f'] as const;
export const HAIR_STYLES = ['none', 'buzzed', 'parted', 'buzzedFemale', 'long', 'buns'] as const;
export const FACIAL_HAIR_STYLES = ['none', 'beard'] as const;
export const ACCESSORIES = ['headband', 'armSleeve', 'goggles', 'glasses'] as const;
export const POSES = ['relaxed', 'handsOnHips', 'armsCrossed', 'celebrate'] as const;
export const MAX_ACCESSORIES = 4;

export type AppearanceFrame = (typeof APPEARANCE_FRAMES)[number];
export type HairStyleId = (typeof HAIR_STYLES)[number];
export type FacialHairId = (typeof FACIAL_HAIR_STYLES)[number];
export type AccessoryId = (typeof ACCESSORIES)[number];
export type PoseId = (typeof POSES)[number];

/** How a custom person looks. Real people never have one: they're figurines. */
export interface PersonAppearance {
    version: 1;
    frame: AppearanceFrame;
    skin: string;
    hair: { style: HairStyleId; color: string };
    facialHair: { style: FacialHairId; color: string };
    build: { girth: number; shoulders: number; wingspan: number };
    accessories: { id: AccessoryId; color: string }[];
    /** Worn when the team gives the player no roster number. */
    jerseyNumber?: string | null;
    pose: PoseId;
}

// Custom coaches and GMs (#294). Staff wear only what STAFF_ACCESSORIES lists.
export const OUTFIT_STYLES = ['suit', 'polo', 'tracksuit'] as const;
export const AGE_LOOKS = ['young', 'prime', 'veteran'] as const;
export const STAFF_ACCESSORIES = ['glasses'] as const;
export const STAFF_HEIGHT_INCHES = { min: 60, max: 90 } as const;

export type OutfitStyleId = (typeof OUTFIT_STYLES)[number];
export type AgeLookId = (typeof AGE_LOOKS)[number];

export interface StaffOutfit {
    style: OutfitStyleId;
    primary: string;
    secondary: string;
}

/** A custom coach's or GM's look: a person's look plus height, outfit and age. Never a jersey number. */
export interface StaffAppearance extends Omit<PersonAppearance, 'build' | 'jerseyNumber'> {
    build: PersonAppearance['build'] & { heightIn: number };
    outfit: StaffOutfit;
    ageLook: AgeLookId;
}
