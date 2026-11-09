import type { CourtDesign, TeamUniform } from '@/models/api';
import type { ScenePerson } from './people';

// Everything the share card's 3D team photo is drawn from. The same fields
// as the live 3D view's props.
export interface TeamPhotoInput {
    court: CourtDesign | null;
    logoUrl?: string;
    drawingUrl?: string;
    capacity: number | null;
    people: ScenePerson[];
    jerseyUrl?: string;
    teamName: string;
    // The owner's colours; null or absent samples them from the jersey.
    uniform?: TeamUniform | null;
}

// Equal keys mean the photo would come out the same, so it can be reused.
export const teamPhotoKey = (input: TeamPhotoInput): string =>
    JSON.stringify([
        input.court,
        input.logoUrl ?? null,
        input.drawingUrl ?? null,
        input.capacity,
        input.jerseyUrl ?? null,
        input.teamName,
        input.uniform ? [input.uniform.primary, input.uniform.secondary, input.uniform.trim] : null,
        input.people.map((person) => [
            person.id,
            person.name,
            person.role,
            person.position ?? null,
            person.heightInches,
            person.weightPounds,
            person.number ?? null,
        ]),
    ]);
