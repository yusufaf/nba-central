// Mirrored from apps/cdk/models/custom-entities.ts; apps/cdk's
// test/utilities/appearance.test.ts fails if the copies drift.
// Keep this file free of imports: that test loads it outside Vite.

export const APPEARANCE_FRAMES = ['m', 'f'] as const;
export const HAIR_STYLES = ['none', 'buzzed', 'parted'] as const;
export const FACIAL_HAIR_STYLES = ['none', 'beard'] as const;
export const ACCESSORIES = ['headband', 'armSleeve', 'goggles', 'glasses'] as const;
export const POSES = ['relaxed'] as const;
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
