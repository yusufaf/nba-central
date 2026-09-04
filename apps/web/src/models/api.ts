import type { NBA2KRating, Player, RatingSource } from './types';

// #region File API Types
export interface InitiateMultipartUploadPayload {
    fileName: string;
    fileType: string;
    fileSize: number;
}

export interface InitiateMultipartUploadResponse {
    uploadId: string;
    key: string;
}

export interface GetMultipartSignedUrlsPayload {
    fileName: string;
    uploadId: string;
    partCount: number;
}

export interface SignedUrlData {
    signedUrl: string;
    partNumber: number;
}

export interface GetMultipartSignedUrlsResponse {
    urls: SignedUrlData[];
}

export interface CompleteMultipartUploadPayload {
    uploadId: string;
    key: string;
    parts: {
        ETag: string;
        PartNumber: number;
    }[];
}

export interface CompleteMultipartUploadResponse {
    name: string;
    key: string;
    size: number;
    signedURL: string;
}

export interface DeleteFilePayload {
    key: string;
}

export interface DeleteFileResponse {
    success: boolean;
    message: string;
}
// #endregion

//#region Team API Types

// A player as stored on a saved team - the same `Player` union already used
// while building a roster (API and custom players have different field
// sets), snapshotted so a saved team renders exactly as it did when saved
// rather than drifting with later roster/rating changes upstream. `fullName`
// is always set on a player before it reaches the roster, so it's the one
// required field here.
export type PlayerSnapshot = Player & { fullName: string };

export interface TeamRosterEntry {
    slot: number;
    player: PlayerSnapshot;
}

// Coaches/GMs from the checked-in JSON are only identified by name; custom
// ones also carry a UUID.
export interface EntityRef {
    name: string;
    isCustom: boolean;
    uuid?: string;
}

export interface TeamArenaRef {
    name: string;
    imgLink?: string;
}

export interface SaveTeamPayload {
    title: string;
    description?: string;
    city?: string;
    country?: string;
    logoUrl?: string;
    roster: TeamRosterEntry[];
    coach: EntityRef | null;
    gm: EntityRef | null;
    arena: TeamArenaRef | null;
}

export interface UpdateTeamPayload extends SaveTeamPayload {
    teamUUID: string;
}

export interface SavedTeam {
    teamUUID: string;
    userUUID: string;
    username: string;
    title: string;
    description: string;
    city: string;
    country: string;
    logoUrl: string;
    playerCount: number;
    roster: TeamRosterEntry[];
    coach: EntityRef | null;
    gm: EntityRef | null;
    arena: TeamArenaRef | null;
    favorited: boolean;
    label: string;
    lastViewed: number;
    createdAt: number;
    updatedAt: number;
}

export type TeamSummary = Omit<SavedTeam, 'roster' | 'coach' | 'gm' | 'arena'>;

export type ApiResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

export type CreateTeamResponse = ApiResult<SavedTeam>;
export type ListTeamsResponse = ApiResult<{ teams: TeamSummary[] }>;
export type GetTeamResponse = ApiResult<SavedTeam>;
export type UpdateTeamResponse = ApiResult<SavedTeam>;
export type DeleteTeamResponse = ApiResult<void>;

// #endregion

//#region Data API Types
export interface TeamLogo {
    alt: string;
    height: number;
    href: string;
    lastUpdated: string;
    rel: string[];
    width: number;
}

export interface TeamData {
    abbreviation: string;
    displayName: string;
    logos: TeamLogo[];
}

// The Lambda returns a bare array, not { teams: [...] }.
export type GetTeamLogosResponse = TeamData[];

export interface GetPlayersParams {
    search?: string;
    position?: string;
    sort?: 'name' | 'team' | 'rating';
    direction?: 'asc' | 'desc';
    minRating?: number;
    limit?: number;
    cursor?: string;
}

// A player record as returned by the getPlayers Lambda. `id` is the
// Basketball-Reference id (e.g. "jamesle01"), not a number.
export interface PlayerRecord {
    id: string;
    first_name: string;
    last_name: string;
    position: string;
    team: {
        full_name: string;
        abbreviation: string;
    };
    height_feet: number | null;
    height_inches: number | null;
    weight_pounds: number | null;
    active: boolean;
    rating?: number;
    ratingSource?: RatingSource;
    // Specific positions (PG/SG/SF/PF/C) from 2K, when the player is rated.
    positions?: string[];
    isCustom?: boolean;
}

export interface GetPlayersResponse {
    data: PlayerRecord[];
    nextCursor?: string | null;
    total?: number;
    /** Which NBA 2K release the ratings in this response come from. */
    gameVersion?: string;
}

export interface PlayerSeasonStats {
    season: number;
    games_played: number;
    min: number;
    fgm: number;
    fga: number;
    fg_pct: number;
    fg3m: number;
    fg3a: number;
    fg3_pct: number;
    ftm: number;
    fta: number;
    ft_pct: number;
    oreb: number;
    dreb: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    turnover: number;
    pf: number;
    pts: number;
}

export interface GetPlayerStatsResponse {
    data: PlayerSeasonStats[];
    rating?: number;
    ratingSource?: RatingSource;
    /** Overall per NBA 2K release, newest first. Current players only. */
    ratingHistory?: NBA2KRating[];
    gameVersion?: string;
}
// #endregion

//#region News API Types
export type NewsSource = "ESPN" | "Reddit" | "Bluesky";

export interface NewsArticle {
    id: string;
    source: NewsSource;
    headline: string;
    url: string;
    author: string;
    publishedAt: string;
    thumbnailUrl?: string;
    summary?: string;
}

export type GetNewsResponse = NewsArticle[];
// #endregion
