import { describe, expect, it } from 'vitest';
import { sceneLabel, scenePeople } from '@/components/scene3d/people';

describe('scenePeople', () => {
    it('maps starters in the given order, then coach and GM', () => {
        const people = scenePeople(
            [
                { slot: 2, player: { fullName: 'Two', position: 'SG', heightFeet: 6, heightInches: 1, weightPounds: 180 } },
                { slot: 1, player: { fullName: 'One', position: 'PG', height_feet: 6, height_inches: 5, weight_pounds: 205 } },
            ],
            { coach: { name: 'Hale' }, gm: { name: 'Reyes' } },
        );
        expect(people).toEqual([
            { id: 'player-2', name: 'Two', role: 'player', position: 'SG', heightInches: 73, weightPounds: 180 },
            { id: 'player-1', name: 'One', role: 'player', position: 'PG', heightInches: 77, weightPounds: 205 },
            { id: 'coach', name: 'Hale', role: 'coach', heightInches: null, weightPounds: null },
            { id: 'gm', name: 'Reyes', role: 'gm', heightInches: null, weightPounds: null },
        ]);
    });

    it('leaves out a missing or blank-named coach or GM', () => {
        expect(scenePeople([], { coach: { name: '  ' }, gm: null })).toEqual([]);
        expect(scenePeople([], {}).length).toBe(0);
    });

    it('carries a valid roster number', () => {
        const [person] = scenePeople([{ slot: 1, player: { fullName: 'One' }, number: '00' }], {});
        expect(person.number).toBe('00');
    });

    it('drops an invalid roster number', () => {
        const [person] = scenePeople([{ slot: 1, player: { fullName: 'One' }, number: '07' }], {});
        expect(person).not.toHaveProperty('number');
    });

    it('a starter without size fields gets null sizes', () => {
        const [person] = scenePeople([{ slot: 3, player: { fullName: 'Three' } }], {});
        expect(person).toMatchObject({ id: 'player-3', heightInches: null, weightPounds: null });
    });
});

describe('sceneLabel', () => {
    const people = scenePeople([{ slot: 1, player: { fullName: 'One' } }], { coach: { name: 'Hale' } });

    it('names the team and everyone in it', () => {
        expect(sceneLabel('Bulls', people)).toBe("3D view of Bulls's court: One, Hale");
    });

    it('falls back to "the team" for a blank title', () => {
        expect(sceneLabel('  ', people)).toBe("3D view of the team's court: One, Hale");
        expect(sceneLabel(undefined, people)).toBe("3D view of the team's court: One, Hale");
    });

    it('has no list when nobody is there', () => {
        expect(sceneLabel('Bulls', [])).toBe("3D view of Bulls's court");
    });
});
