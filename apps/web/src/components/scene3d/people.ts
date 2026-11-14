// Who stands in the 3D scene, shared by the public page and the builder: the
// starters in the order given, then the staff. Imported by this path, not
// through index.ts, so pages that mock the 3D module still get it.
import type { PersonAppearance } from '@/constants/appearance';
import type { PersonInput } from '@/three/character/person';
import { parseAppearance } from '@/utils/appearance';
import { snapshotSize, type SizeFields } from '@/utils/playerSize';
import { isJerseyNumber } from '@/utils/rosterNumbers';

export type ScenePerson = PersonInput;
export type ScenePlayer = { fullName?: string; position?: string; isCustom?: boolean; appearance?: unknown } & SizeFields;

type Staff = { name?: string } | null | undefined;

export const scenePeople = (
    starters: { slot: number; player: ScenePlayer; number?: unknown }[],
    staff: { coach?: Staff; gm?: Staff },
): ScenePerson[] => [
    ...starters.map(({ slot, player, number }) => {
        // Only a custom player has a look; real people stay figurines.
        const appearance = player.isCustom === true ? parseAppearance(player.appearance) : null;
        // The roster's number, else the custom player's own.
        const worn = isJerseyNumber(number) ? number : appearance?.jerseyNumber;
        return {
            id: `player-${slot}`,
            name: player.fullName ?? '',
            role: 'player' as const,
            position: player.position,
            ...snapshotSize(player),
            ...(isJerseyNumber(worn) && { number: worn }),
            ...(appearance && { appearance }),
        };
    }),
    ...(['coach', 'gm'] as const).flatMap((role) => {
        const name = staff[role]?.name?.trim();
        return name ? [{ id: role, name, role, heightInches: null, weightPounds: null }] : [];
    }),
];

/**
 * The creator's preview person. It takes no name on purpose: the build never
 * draws one, so typing a name mustn't rebuild the figure.
 */
export const previewPerson = (
    profile: { position: string; heightFeet: number; heightInches: number; weightPounds: number },
    look: PersonAppearance,
): ScenePerson => {
    const inches = profile.heightFeet * 12 + profile.heightInches;
    return {
        id: 'preview',
        name: '',
        role: 'player',
        position: profile.position,
        heightInches: Number.isFinite(inches) && inches > 0 ? inches : null,
        weightPounds: Number.isFinite(profile.weightPounds) && profile.weightPounds > 0 ? profile.weightPounds : null,
        number: isJerseyNumber(look.jerseyNumber) ? look.jerseyNumber : null,
        appearance: look,
    };
};

export const sceneLabel = (title: string | null | undefined, people: ScenePerson[]): string => {
    const names = people.map((person) => person.name).join(', ');
    return `3D view of ${title?.trim() || 'the team'}'s court${names ? `: ${names}` : ''}`;
};
