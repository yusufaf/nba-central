import type { PersonAppearance, StaffAppearance } from '@/constants/appearance';
import type { CoachSpecialty, PlayerPosition } from '@/models/types';

/** What the player creator saves: the profile plus the look. */
export interface CustomPlayerPayload {
    name: string;
    position: PlayerPosition;
    heightFeet: number;
    heightInches: number;
    weightPounds: number;
    overallRating: number;
    appearance: PersonAppearance;
}

/** What the staff creator saves for a coach. */
export interface CustomCoachPayload {
    name: string;
    overallRating: number;
    specialty: CoachSpecialty;
    appearance: StaffAppearance;
}

/** What the staff creator saves for a GM. */
export interface CustomGMPayload {
    name: string;
    teams: string[];
    appearance: StaffAppearance;
}

/** The staff creator's height draft, copied into the look once it's in range. */
export interface StaffHeight {
    feet: number;
    inches: number;
}
