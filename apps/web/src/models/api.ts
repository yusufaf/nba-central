import type { NBA2KRating, Player, RatingSource } from './types';
import type { SettingsMap } from '@/constants/settings';

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

//#region Users API Types

// Mirrors apps/cdk/models/api/user-settings-api.ts.
export interface UserSettingsData {
    settings: SettingsMap;
    // null until the account's first write - the cue to migrate this
    // browser's localStorage preferences up.
    updatedAt: string | null;
}

export interface GetUserSettingsData extends UserSettingsData {
    // The image uploadAvatar last stored, or null.
    avatarUrl: string | null;
}

export type GetUserSettingsResponse = ApiResult<GetUserSettingsData>;
export type UpdateUserSettingsResponse = ApiResult<UserSettingsData>;

// Mirrors apps/cdk/models/api/user-profile-api.ts.
export interface UserStats {
    teams: number;
    publishedTeams: number;
    customCoaches: number;
    customGMs: number;
    customPlayers: number;
}

export type GetUserStatsResponse = ApiResult<UserStats>;
export type UploadAvatarResponse = ApiResult<{ avatarUrl: string }>;

// Mirrors apps/cdk/models/api/user-data-api.ts. Items are the stored ones
// minus the table keys, so they are passed through as they come.
export type ExportedItem = Record<string, unknown>;

export interface UserDataExport {
    version: 1;
    exportedAt: string;
    user: { id: string; username: string | null };
    settings: SettingsMap;
    settingsUpdatedAt: string | null;
    avatarUrl: string | null;
    teams: ExportedItem[];
    customCoaches: ExportedItem[];
    customGMs: ExportedItem[];
    customPlayers: ExportedItem[];
    customArenas: ExportedItem[];
    other: ExportedItem[];
}

export type ExportUserDataResponse = ApiResult<UserDataExport>;
export type DeleteUserDataResponse = ApiResult<{ deletedItems: number; deletedFiles: number }>;
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

// Mirrors apps/cdk/models/api/teams-api.ts. Built-in arenas keep their full
// details (rows saved before custom arenas only have name and imgLink, and
// hydrateTeam fills the rest from arenas.json). A custom arena keeps its
// arenaUUID plus a text copy, shown if the arena is deleted.
export interface TeamArenaRef {
    name: string;
    location?: string;
    capacity?: number;
    openedYear?: number;
    // Built-in only.
    imgLink?: string;
    // Absent = built-in.
    isCustom?: boolean;
    arenaUUID?: string;
}

// What getTeam and getPublicTeam return: the ref with the live arena.
export interface ResolvedArena extends TeamArenaRef {
    court?: CourtDesign;
    photoUrl?: string;
    logoUrl?: string;
    drawingUrl?: string;
    // The arena was deleted: show the text copy alone.
    missing?: true;
}

export interface SaveTeamPayload {
    title: string;
    description?: string;
    city?: string;
    country?: string;
    logoUrl?: string;
    jerseyUrl?: string;
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
    jerseyUrl: string;
    playerCount: number;
    roster: TeamRosterEntry[];
    coach: EntityRef | null;
    gm: EntityRef | null;
    arena: ResolvedArena | null;
    favorited: boolean;
    label: string;
    // Share loop: opt-in, link-only. Absent on rows saved before the feature
    // shipped, which the UI treats as false.
    public: boolean;
    publishedAt?: number;
    cardUrl?: string;
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

// What /api/teams/public/{teamUUID} returns — everything the public page and
// a remix need, minus the owner's id and bookkeeping. `username` is the
// attribution.
export type PublicTeam = Omit<
    SavedTeam,
    'userUUID' | 'favorited' | 'label' | 'lastViewed'
>;

export interface PublishTeamPayload {
    teamUUID: string;
    public: boolean;
    // Base64 PNG (no data: prefix) from useShareCard; null when the render
    // failed or when unpublishing.
    cardPng?: string | null;
}

export type PublishTeamResponse = ApiResult<SavedTeam>;
export type GetPublicTeamResponse = ApiResult<PublicTeam>;
// #endregion

//#region Custom Arena API Types
// Mirrors apps/cdk/models/custom-entities.ts and custom-entities-api.ts.
export interface CourtDesign {
    version: 1;
    wood: 'maple' | 'honey' | 'walnut' | 'ash' | 'ebony';
    paint: string | null;
    apron: string | null;
    lines: string;
    centerLogo: 'none' | 'team' | 'upload';
    baselineText: string;
    sidelineText: string;
}

export type ArenaImageSlot = 'photo' | 'logo' | 'drawing';

export interface CustomArenaPayload {
    name: string;
    location: string;
    capacity: number | null;
    openedYear: number | null;
    court: CourtDesign | null;
}

export interface CustomArena extends CustomArenaPayload {
    arenaUUID: string;
    photoUrl?: string;
    logoUrl?: string;
    drawingUrl?: string;
    created: string;
    isCustom: true;
}

export type CreateCustomArenaResponse = ApiResult<CustomArena>;
export type ListCustomArenasResponse = ApiResult<{ customArenas: CustomArena[] }>;
export type UpdateCustomArenaResponse = ApiResult<CustomArena>;
export type DeleteCustomArenaResponse = ApiResult<void>;
export type UploadArenaImageResponse = ApiResult<{ url: string }>;
export type DeleteArenaImageResponse = ApiResult<void>;
// #endregion

//#region Feedback API Types
// Mirrors apps/cdk/models/api/feedback-api.ts minus the optional reply-to
// email, which the UI doesn't collect - the route is authenticated, so the
// Lambda already knows who sent it.
export interface SendFeedbackPayload {
    message: string;
    subject?: string;
}

export type SendFeedbackResponse = ApiResult<{ messageId: string }>;

// #endregion

//#region Data API Types
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
