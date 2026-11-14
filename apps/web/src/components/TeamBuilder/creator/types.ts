import type { PersonAppearance } from '@/constants/appearance';
import type { PlayerPosition } from '@/models/types';

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
