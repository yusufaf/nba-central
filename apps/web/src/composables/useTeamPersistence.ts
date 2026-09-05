import type { Player } from "@/models/types";
import type {
    EntityRef,
    PlayerSnapshot,
    SaveTeamPayload,
    SavedTeam,
    TeamArenaRef,
    TeamRosterEntry,
} from "@/models/api";

interface BuilderState {
    teamName: string;
    teamDescription: string;
    teamCity: string;
    teamCountry: string;
    teamLogo: string;
    teamJersey: string;
    selectedPlayersData: Map<number, any>;
    teamCoach: any;
    teamArena: any;
    teamGM: any;
}

// Career stats/rating history are fetched per slot (getPlayerStats) rather
// than saved on the team - they're derived from the player's id, not part
// of the roster choice, and re-fetching keeps a saved team from going stale
// the moment a player's career continues.
const toSnapshot = (player: any): PlayerSnapshot => {
    const {
        playerStats: _playerStats,
        ratingHistory: _ratingHistory,
        heightAndWeight: _heightAndWeight,
        ...snapshot
    } = player;
    return snapshot as PlayerSnapshot;
};

const toEntityRef = (entity: any): EntityRef | null => {
    if (!entity) return null;
    return {
        name: entity.name,
        isCustom: !!entity.isCustom,
        uuid: entity.coachUUID || entity.gmUUID || entity.playerUUID || undefined,
    };
};

const toArenaRef = (arena: any): TeamArenaRef | null => {
    if (!arena) return null;
    return { name: arena.name, imgLink: arena.imgLink };
};

/**
 * Builds the save/update payload from the builder's live refs. Roster is
 * sorted by slot - Map iteration is insertion order, which would save a
 * reordered roster in the order the players happened to be added.
 */
export const serializeTeam = (state: BuilderState): SaveTeamPayload => {
    const roster: TeamRosterEntry[] = Array.from(
        state.selectedPlayersData.entries(),
    )
        .sort(([a], [b]) => a - b)
        .map(([slot, player]) => ({ slot, player: toSnapshot(player) }));

    return {
        title: state.teamName,
        description: state.teamDescription,
        city: state.teamCity,
        country: state.teamCountry,
        logoUrl: state.teamLogo,
        jerseyUrl: state.teamJersey,
        roster,
        coach: toEntityRef(state.teamCoach),
        gm: toEntityRef(state.teamGM),
        arena: toArenaRef(state.teamArena),
    };
};

export interface HydratedTeam {
    teamName: string;
    teamDescription: string;
    teamCity: string;
    teamCountry: string;
    teamLogo: string;
    teamJersey: string;
    players: Map<number, Player>;
    teamCoach: EntityRef | null;
    teamArena: TeamArenaRef | null;
    teamGM: EntityRef | null;
}

/** Inverse of serializeTeam - tolerates a null coach/GM/arena and an empty roster. */
export const hydrateTeam = (saved: SavedTeam): HydratedTeam => {
    const players = new Map<number, Player>();
    for (const entry of saved.roster ?? []) {
        players.set(entry.slot, entry.player);
    }

    return {
        teamName: saved.title ?? "",
        teamDescription: saved.description ?? "",
        teamCity: saved.city ?? "",
        teamCountry: saved.country ?? "",
        teamLogo: saved.logoUrl ?? "",
        teamJersey: saved.jerseyUrl ?? "",
        players,
        teamCoach: saved.coach ?? null,
        teamArena: saved.arena ?? null,
        teamGM: saved.gm ?? null,
    };
};
