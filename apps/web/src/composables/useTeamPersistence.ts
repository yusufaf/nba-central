import type { Arena, Coach, GM, Player } from "@/models/types";
import { resolveLegacyLogoUrl } from "@/utils/historicalLogoUrl";
import { backfillArena, parseCapacity } from "@/utils/arenaDetails";
import type {
    CustomArena,
    EntityRef,
    PlayerSnapshot,
    PublicTeam,
    ResolvedArena,
    SaveTeamPayload,
    TeamArenaRef,
    TeamRosterEntry,
} from "@/models/api";

// What the builder can hold as its arena: a row from arenas.json, one of the
// user's custom arenas from the drawer, or the resolved arena a load returned.
export type BuilderArena = Arena | CustomArena | ResolvedArena;

interface BuilderState {
    teamName: string;
    teamDescription: string;
    teamCity: string;
    teamCountry: string;
    teamLogo: string;
    teamJersey: string;
    selectedPlayersData: Map<number, Player>;
    teamCoach: Coach | null;
    teamArena: BuilderArena | null;
    teamGM: GM | null;
}

// Career stats/rating history are fetched per slot (getPlayerStats) rather
// than saved on the team - they're derived from the player's id, not part
// of the roster choice, and re-fetching keeps a saved team from going stale
// the moment a player's career continues.
const toSnapshot = (player: Player): PlayerSnapshot => {
    const {
        playerStats: _playerStats,
        ratingHistory: _ratingHistory,
        heightAndWeight: _heightAndWeight,
        ...snapshot
    } = player;
    return snapshot as PlayerSnapshot;
};

const toEntityRef = (entity: Coach | GM | null): EntityRef | null => {
    if (!entity) return null;
    return {
        name: entity.name,
        isCustom: !!entity.isCustom,
        uuid: ("coachUUID" in entity && entity.coachUUID) || ("gmUUID" in entity && entity.gmUUID) || undefined,
    };
};

// Only the stored fields. A resolved arena's court, image URLs and `missing`
// flag are read live on every load, so they're never sent back.
const toArenaRef = (arena: BuilderArena | null): TeamArenaRef | null => {
    if (!arena) return null;
    const details = {
        name: arena.name,
        location: arena.location || undefined,
        capacity: parseCapacity(arena.capacity),
        openedYear: arena.openedYear ?? undefined,
    };
    if ("arenaUUID" in arena && arena.arenaUUID) {
        return { ...details, isCustom: true, arenaUUID: arena.arenaUUID };
    }
    // A custom arena without a link: deleted, or from someone else's team.
    if ("isCustom" in arena && arena.isCustom) {
        return { ...details, isCustom: true };
    }
    return { ...details, imgLink: "imgLink" in arena ? arena.imgLink : undefined };
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
    teamArena: ResolvedArena | null;
    teamGM: EntityRef | null;
}

/** Inverse of serializeTeam - tolerates a null coach/GM/arena and an empty roster. */
export const hydrateTeam = (saved: PublicTeam): HydratedTeam => {
    const players = new Map<number, Player>();
    for (const entry of saved.roster ?? []) {
        players.set(entry.slot, entry.player);
    }

    return {
        teamName: saved.title ?? "",
        teamDescription: saved.description ?? "",
        teamCity: saved.city ?? "",
        teamCountry: saved.country ?? "",
        teamLogo: resolveLegacyLogoUrl(saved.logoUrl ?? ""),
        teamJersey: saved.jerseyUrl ?? "",
        players,
        teamCoach: saved.coach ?? null,
        teamArena: backfillArena(saved.arena ?? null),
        teamGM: saved.gm ?? null,
    };
};

// A remix starts life as a new team owned by whoever is remixing; the
// title says where it came from, once.
export const remixTitle = (title: string): string => {
    const trimmed = title.trim();
    if (!trimmed) return "Remix";
    return trimmed.startsWith("Remix of ") ? trimmed : `Remix of ${trimmed}`;
};
