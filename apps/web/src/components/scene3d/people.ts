// Who stands in the 3D scene, shared by the public page and the builder: the
// starters in the order given, then the staff. Imported by this path, not
// through index.ts, so pages that mock the 3D module still get it.
import type { PersonAppearance, StaffAppearance } from '@/constants/appearance';
import type { PersonInput } from '@/three/character/person';
import { parseAppearance, parseStaffAppearance } from '@/utils/appearance';
import { snapshotSize, staffSize, type SizeFields } from '@/utils/playerSize';
import { isJerseyNumber } from '@/utils/rosterNumbers';

export type ScenePerson = PersonInput;
export type ScenePlayer = { fullName?: string; position?: string; isCustom?: boolean; appearance?: unknown } & SizeFields;

type Staff = { name?: string; isCustom?: boolean; appearance?: unknown } | null | undefined;

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
        const person = staff[role];
        const name = person?.name?.trim();
        if (!name) return [];
        // Only a custom coach or GM has a look; real staff stay figurines.
        const look = person?.isCustom === true ? parseStaffAppearance(person.appearance) : null;
        return [
            {
                id: role,
                name,
                role,
                ...(look ? staffSize(look) : { heightInches: null, weightPounds: null }),
                ...(look && { appearance: look }),
            },
        ];
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

/** The staff creator's preview person, nameless for the same reason. */
export const previewStaff = (role: 'coach' | 'gm', look: StaffAppearance): ScenePerson => ({
    id: 'preview',
    name: '',
    role,
    ...staffSize(look),
    appearance: look,
});

export const sceneLabel = (title: string | null | undefined, people: ScenePerson[]): string => {
    const names = people.map((person) => person.name).join(', ');
    return `3D view of ${title?.trim() || 'the team'}'s court${names ? `: ${names}` : ''}`;
};
