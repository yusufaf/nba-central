// What the player creator offers, and the rules that keep a look valid for
// its body frame. Pure data, so the 3D code and the UI share it.
import type { AppearanceFrame, FacialHairId, HairStyleId, PersonAppearance, PoseId } from '@/constants/appearance';

type Cut = Exclude<HairStyleId, 'none'>;
type Facial = Exclude<FacialHairId, 'none'>;

// Each cut is shaped for one head: on the other it leaves the crown bare or
// floats above the skull (checked with magenta skin, #292).
export const HAIR_FITS: Record<Cut, readonly AppearanceFrame[]> = {
    buzzed: ['m'],
    parted: ['m'],
    buzzedFemale: ['f'],
    long: ['f'],
    buns: ['f'],
};

export const FACIAL_HAIR_FITS: Record<Facial, readonly AppearanceFrame[]> = {
    beard: ['m'],
};

export const fits = (frame: AppearanceFrame, style: HairStyleId): boolean =>
    style === 'none' || HAIR_FITS[style].includes(frame);

export const facialHairFits = (frame: AppearanceFrame, style: FacialHairId): boolean =>
    style === 'none' || FACIAL_HAIR_FITS[style].includes(frame);

// The nearest cut on the other head.
export const HAIR_SWAP: Record<Cut, Cut> = {
    buzzed: 'buzzedFemale',
    buzzedFemale: 'buzzed',
    parted: 'long',
    long: 'parted',
    buns: 'parted',
};

const firstFitting = (frame: AppearanceFrame): HairStyleId =>
    (Object.keys(HAIR_FITS) as Cut[]).find((style) => fits(frame, style)) ?? 'none';

/** The same look on another frame, with hair that fits that head. */
export const forFrame = (look: PersonAppearance, frame: AppearanceFrame): PersonAppearance => {
    const current = look.hair.style;
    let style: HairStyleId = current;
    if (!fits(frame, current)) {
        const swapped = HAIR_SWAP[current as Cut];
        style = fits(frame, swapped) ? swapped : firstFitting(frame);
    }
    return {
        ...look,
        frame,
        hair: { ...look.hair, style },
        facialHair: facialHairFits(frame, look.facialHair.style) ? { ...look.facialHair } : { ...look.facialHair, style: 'none' },
        build: { ...look.build },
        accessories: look.accessories.map((accessory) => ({ ...accessory })),
    };
};

export const FRAME_LABELS: Record<AppearanceFrame, string> = { m: 'Athletic M', f: 'Athletic F' };

export const HAIR_LABELS: Record<HairStyleId, string> = {
    none: 'None',
    buzzed: 'Buzzed',
    parted: 'Parted',
    buzzedFemale: 'Buzzed',
    long: 'Long',
    buns: 'Buns',
};

export const FACIAL_HAIR_LABELS: Record<FacialHairId, string> = { none: 'None', beard: 'Beard' };

export const POSE_LABELS: Record<PoseId, string> = {
    relaxed: 'Relaxed',
    handsOnHips: 'Hands on hips',
    armsCrossed: 'Arms crossed',
    celebrate: 'Celebrate',
};

export interface Swatch {
    value: string;
    label: string;
}

export const SKIN_SWATCHES: Swatch[] = ['#382216', '#533422', '#724a2f', '#956543', '#b6825c', '#cfa17b', '#e2bd9a', '#f0d4ba'].map(
    (value, i) => ({ value, label: `Skin tone ${i + 1}` }),
);

export const HAIR_SWATCHES: Swatch[] = [
    { value: '#1b1512', label: 'Black' },
    { value: '#3b2a1e', label: 'Dark brown' },
    { value: '#6a4a32', label: 'Brown' },
    { value: '#8a3b1f', label: 'Auburn' },
    { value: '#c9a46a', label: 'Blonde' },
    { value: '#e6dcc8', label: 'Platinum' },
    { value: '#9a9a9a', label: 'Grey' },
    { value: '#2f5d9b', label: 'Blue' },
];

export type PresetId = 'guard' | 'wing' | 'big';

export interface BodyProfile {
    heightFeet: number;
    heightInches: number;
    weightPounds: number;
}

export interface BodyPreset extends BodyProfile {
    id: PresetId;
    label: string;
    build: PersonAppearance['build'];
}

const preset = (id: PresetId, label: string, size: [number, number, number], build: [number, number, number]): BodyPreset => ({
    id,
    label,
    heightFeet: size[0],
    heightInches: size[1],
    weightPounds: size[2],
    build: { girth: build[0], shoulders: build[1], wingspan: build[2] },
});

export const BODY_PRESETS: Record<AppearanceFrame, BodyPreset[]> = {
    m: [
        preset('guard', 'Guard', [6, 3, 195], [-0.2, -0.1, 0]),
        preset('wing', 'Wing', [6, 6, 215], [0, 0, 0.3]),
        preset('big', 'Big', [6, 11, 245], [0.3, 0.3, 0.2]),
    ],
    f: [
        preset('guard', 'Guard', [5, 9, 150], [-0.2, -0.1, 0]),
        preset('wing', 'Wing', [6, 0, 170], [0, 0, 0.3]),
        preset('big', 'Big', [6, 4, 195], [0.3, 0.3, 0.2]),
    ],
};

export const presetMatching = (frame: AppearanceFrame, profile: BodyProfile, build: PersonAppearance['build']): PresetId | 'custom' =>
    BODY_PRESETS[frame].find(
        (p) =>
            p.heightFeet === profile.heightFeet &&
            p.heightInches === profile.heightInches &&
            p.weightPounds === profile.weightPounds &&
            p.build.girth === build.girth &&
            p.build.shoulders === build.shoulders &&
            p.build.wingspan === build.wingspan,
    )?.id ?? 'custom';

const FRAME_WORDS: Record<AppearanceFrame, string> = { m: 'athletic male frame', f: 'athletic female frame' };

/** What the preview shows, for a screen reader. */
export const appearanceLabel = (name: string, look: PersonAppearance): string => {
    const hair = look.hair.style === 'none' ? 'no hair' : `${HAIR_LABELS[look.hair.style].toLowerCase()} hair`;
    const facial = look.facialHair.style === 'none' ? 'no facial hair' : FACIAL_HAIR_LABELS[look.facialHair.style].toLowerCase();
    return `3D preview of ${name}: ${FRAME_WORDS[look.frame]}, ${hair}, ${facial}, ${POSE_LABELS[look.pose].toLowerCase()}`;
};
