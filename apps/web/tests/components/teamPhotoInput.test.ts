import { describe, expect, it } from 'vitest';
import { teamPhotoKey, type TeamPhotoInput } from '@/components/scene3d/teamPhotoInput';
import { newCourt } from '@/utils/court';

const base = (): TeamPhotoInput => ({
    court: newCourt('Owls'),
    logoUrl: 'logo.png',
    drawingUrl: undefined,
    capacity: 18000,
    people: [
        { id: 'player-1', name: 'A', role: 'player', position: 'PG', heightInches: 75, weightPounds: 190 },
        { id: 'coach', name: 'C', role: 'coach', heightInches: null, weightPounds: null },
    ],
    jerseyUrl: 'jersey.png',
    teamName: 'Owls',
});

describe('teamPhotoKey', () => {
    it('is equal for equal inputs', () => {
        expect(teamPhotoKey(base())).toBe(teamPhotoKey(base()));
    });

    it.each<[string, (input: TeamPhotoInput) => void]>([
        ["a person's height", (input) => void (input.people[0].heightInches = 80)],
        ['the order of people', (input) => input.people.reverse()],
        ['the jersey', (input) => void (input.jerseyUrl = 'other.png')],
        ['the team name', (input) => void (input.teamName = 'Hawks')],
        ['a court colour', (input) => void (input.court = { ...input.court!, paint: '#123456' })],
        ['the capacity', (input) => void (input.capacity = 12000)],
    ])('changes with %s', (_, change) => {
        const changed = base();
        change(changed);
        expect(teamPhotoKey(changed)).not.toBe(teamPhotoKey(base()));
    });
});
