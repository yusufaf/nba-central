import { describe, expect, it } from 'vitest';
import { previewPerson, sceneLabel, scenePeople } from '@/components/scene3d/people';
import { DEFAULT_APPEARANCE } from '@/utils/appearance';

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

    describe("a custom player's look", () => {
        const LOOK = { ...DEFAULT_APPEARANCE, skin: '#f1c7a5', hair: { style: 'parted', color: '#3b2a1e' } };

        it('carries the parsed appearance of a custom player', () => {
            const [person] = scenePeople([{ slot: 1, player: { fullName: 'Nova', isCustom: true, appearance: LOOK } }], {});
            expect(person.appearance).toEqual(LOOK);
        });

        it('ignores an appearance on a real player', () => {
            const [person] = scenePeople([{ slot: 1, player: { fullName: 'Real', appearance: LOOK } }], {});
            expect(person).not.toHaveProperty('appearance');
        });

        it("wears the player's own number when the roster gives none", () => {
            const player = { fullName: 'Nova', isCustom: true, appearance: { ...LOOK, jerseyNumber: '8' } };
            expect(scenePeople([{ slot: 1, player }], {})[0].number).toBe('8');
            expect(scenePeople([{ slot: 1, player, number: '23' }], {})[0].number).toBe('23');
        });

        it('fills a malformed appearance with defaults', () => {
            const [person] = scenePeople(
                [{ slot: 1, player: { fullName: 'Nova', isCustom: true, appearance: { skin: 'pink', hair: 3 } } }],
                {},
            );
            expect(person.appearance).toEqual(DEFAULT_APPEARANCE);
        });
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

describe('previewPerson', () => {
    const profile = { position: 'PG', heightFeet: 6, heightInches: 3, weightPounds: 195 };

    it("maps the profile's size and the look's number", () => {
        const person = previewPerson(profile, { ...DEFAULT_APPEARANCE, jerseyNumber: '00' });
        expect(person).toMatchObject({ id: 'preview', name: '', role: 'player', position: 'PG', heightInches: 75, weightPounds: 195, number: '00' });
        expect(person.appearance?.jerseyNumber).toBe('00');
    });

    it('has no number without one, and no size from an unusable value', () => {
        expect(previewPerson(profile, DEFAULT_APPEARANCE).number).toBeNull();
        const blank = previewPerson({ ...profile, heightFeet: Number.NaN, weightPounds: Number.NaN }, DEFAULT_APPEARANCE);
        expect(blank.heightInches).toBeNull();
        expect(blank.weightPounds).toBeNull();
    });
});
