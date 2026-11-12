// The one place a stored appearance is read. Anything malformed falls back to
// a default field by field, so a bad snapshot can't break the scene.
import {
    ACCESSORIES,
    APPEARANCE_FRAMES,
    FACIAL_HAIR_STYLES,
    HAIR_STYLES,
    MAX_ACCESSORIES,
    POSES,
    type AccessoryId,
    type PersonAppearance,
} from '@/constants/appearance';
import { isJerseyNumber } from '@/utils/rosterNumbers';

export const DEFAULT_APPEARANCE: PersonAppearance = {
    version: 1,
    frame: 'm',
    skin: '#8d5a3b',
    hair: { style: 'buzzed', color: '#1b1512' },
    facialHair: { style: 'none', color: '#1b1512' },
    build: { girth: 0, shoulders: 0, wingspan: 0 },
    accessories: [],
    pose: 'relaxed',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
    options.includes(value as T) ? (value as T) : fallback;

const colour = (value: unknown, fallback: string): string =>
    typeof value === 'string' && HEX.test(value) ? value : fallback;

const slider = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0;

const accessoriesFrom = (value: unknown): PersonAppearance['accessories'] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<AccessoryId>();
    const kept: PersonAppearance['accessories'] = [];
    for (const entry of value) {
        if (kept.length === MAX_ACCESSORIES) break;
        if (!isRecord(entry) || !ACCESSORIES.includes(entry.id as AccessoryId)) continue;
        if (typeof entry.color !== 'string' || !HEX.test(entry.color)) continue;
        const id = entry.id as AccessoryId;
        if (seen.has(id)) continue;
        seen.add(id);
        kept.push({ id, color: entry.color });
    }
    return kept;
};

/** `null` for anything that isn't an object: that person is a figurine. */
export const parseAppearance = (value: unknown): PersonAppearance | null => {
    if (!isRecord(value)) return null;
    const hair = isRecord(value.hair) ? value.hair : {};
    const facialHair = isRecord(value.facialHair) ? value.facialHair : {};
    const build = isRecord(value.build) ? value.build : {};
    const fallback = DEFAULT_APPEARANCE;
    return {
        version: 1,
        frame: oneOf(APPEARANCE_FRAMES, value.frame, fallback.frame),
        skin: colour(value.skin, fallback.skin),
        hair: {
            style: oneOf(HAIR_STYLES, hair.style, fallback.hair.style),
            color: colour(hair.color, fallback.hair.color),
        },
        facialHair: {
            style: oneOf(FACIAL_HAIR_STYLES, facialHair.style, fallback.facialHair.style),
            color: colour(facialHair.color, fallback.facialHair.color),
        },
        build: { girth: slider(build.girth), shoulders: slider(build.shoulders), wingspan: slider(build.wingspan) },
        accessories: accessoriesFrom(value.accessories),
        ...(isJerseyNumber(value.jerseyNumber) && { jerseyNumber: value.jerseyNumber }),
        pose: oneOf(POSES, value.pose, fallback.pose),
    };
};
