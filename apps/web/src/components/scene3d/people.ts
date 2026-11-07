// Who stands in the 3D scene, shared by the public page and the builder: the
// starters in the order given, then the staff. Imported by this path, not
// through index.ts, so pages that mock the 3D module still get it.
import type { PersonInput } from '@/three/character/person';
import { snapshotSize, type SizeFields } from '@/utils/playerSize';

export type ScenePerson = PersonInput;
export type ScenePlayer = { fullName?: string; position?: string } & SizeFields;

type Staff = { name?: string } | null | undefined;

export const scenePeople = (
    starters: { slot: number; player: ScenePlayer }[],
    staff: { coach?: Staff; gm?: Staff },
): ScenePerson[] => [
    ...starters.map(({ slot, player }) => ({
        id: `player-${slot}`,
        name: player.fullName ?? '',
        role: 'player' as const,
        position: player.position,
        ...snapshotSize(player),
    })),
    ...(['coach', 'gm'] as const).flatMap((role) => {
        const name = staff[role]?.name?.trim();
        return name ? [{ id: role, name, role, heightInches: null, weightPounds: null }] : [];
    }),
];

export const sceneLabel = (title: string | null | undefined, people: ScenePerson[]): string => {
    const names = people.map((person) => person.name).join(', ');
    return `3D view of ${title?.trim() || 'the team'}'s court${names ? `: ${names}` : ''}`;
};
