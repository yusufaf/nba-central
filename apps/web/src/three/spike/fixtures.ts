// Throwaway spike (#119). A sample team and venue. Colours are user content
// (like the court's), so they live here as hex, not as design tokens.
import type { CourtDesign } from '@/models/api';
import type { Venue } from './arena';
import type { CharacterSpec, Frame, HairStyle } from './character';
import type { Kit, KitMode } from './kit';

export const TEAM_NAME = 'Night Owls';

export const SAMPLE_COURT: CourtDesign = {
    version: 1,
    wood: 'honey',
    paint: '#0f5257',
    apron: '#0f5257',
    lines: '#f4f1e8',
    centerLogo: 'none',
    baselineText: 'NIGHT OWLS',
    sidelineText: 'THE NEST',
};

export const SAMPLE_VENUE: Venue = {
    seatPrimary: '#0f5257',
    seatSecondary: '#c9a227',
    pattern: 'sections',
    upperDeck: true,
    scoreboardText: 'NIGHT OWLS',
    ribbonText: 'Welcome to the Nest',
    banners: [
        { title: '2031', subtitle: 'Champions', colour: '#0f5257' },
        { title: '2034', subtitle: 'Champions', colour: '#0f5257' },
        { title: '23', subtitle: 'Vance', colour: '#c9a227' },
        { title: '8', subtitle: 'Okafor', colour: '#c9a227' },
    ],
    lighting: 'broadcast',
    tint: '#ffb020',
};

export const VINYL = '#c8c3ba';
export const HAIR_COLOURS = ['#1b1512', '#3b2a1e', '#6a4a2f', '#b08a5a', '#8a8a8a'];
export const SKIN_TINTS = ['#ffffff', '#f1d3bd', '#d9a988', '#b07a55', '#7a4e33', '#4e3222'];

export const playerKit = (name: string, number: string): Kit => ({
    kind: 'player',
    primary: '#0f5257',
    secondary: '#c9a227',
    trim: '#f4f1e8',
    name,
    number,
    teamName: TEAM_NAME,
});

export const suitKit = (primary: string, secondary: string): Kit => ({
    kind: 'suit',
    primary,
    secondary,
    trim: '#ffffff',
    name: '',
    number: '',
    teamName: TEAM_NAME,
});

interface Person {
    label: string;
    frame: Frame;
    heightInches: number;
    weightPounds: number;
    hair: HairStyle;
    beard: boolean;
    custom: boolean;
    number?: string;
    staff?: { primary: string; secondary: string };
}

// Two custom players, three real ones (figurines), a custom coach and a
// real GM, as on a typical saved team.
export const TEAM: Person[] = [
    { label: 'J. Vance · PG', frame: 'male', heightInches: 75, weightPounds: 190, hair: 'parted', beard: false, custom: true, number: '23' },
    { label: 'D. Okafor · SG', frame: 'male', heightInches: 77, weightPounds: 205, hair: 'none', beard: false, custom: false, number: '8' },
    { label: 'M. Reyes · SF', frame: 'female', heightInches: 74, weightPounds: 170, hair: 'buns', beard: false, custom: true, number: '11' },
    { label: 'T. Brandt · PF', frame: 'male', heightInches: 81, weightPounds: 240, hair: 'none', beard: false, custom: false, number: '34' },
    { label: 'K. Adeyemi · C', frame: 'male', heightInches: 84, weightPounds: 270, hair: 'none', beard: false, custom: false, number: '00' },
    { label: 'Coach Hale', frame: 'male', heightInches: 72, weightPounds: 215, hair: 'buzzed', beard: true, custom: true, staff: { primary: '#1d2a44', secondary: '#c9a227' } },
    { label: 'GM Ortiz', frame: 'female', heightInches: 68, weightPounds: 150, hair: 'long', beard: false, custom: false, staff: { primary: '#2b2b2b', secondary: '#8a1c1c' } },
];

export const teamSpecs = (kitMode: KitMode, skinIndex: number): CharacterSpec[] =>
    TEAM.map((person, i) => ({
        frame: person.frame,
        heightInches: person.heightInches,
        weightPounds: person.weightPounds,
        shoulders: 1,
        wingspan: 1.03,
        hair: person.hair,
        beard: person.beard,
        hairColour: HAIR_COLOURS[i % HAIR_COLOURS.length],
        skinTint: person.custom ? SKIN_TINTS[(skinIndex + i) % SKIN_TINTS.length] : null,
        vinyl: person.custom ? null : VINYL,
        kit: person.staff
            ? suitKit(person.staff.primary, person.staff.secondary)
            : playerKit(person.label.split(' ')[1] ?? '', person.number ?? ''),
        kitMode: person.staff && kitMode === 'none' ? 'painted' : kitMode,
    }));
