import type { NBA2KRating, RatingSource } from './types';

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
    location: string;
    key: string;
}

export interface DeleteFilePayload {
    key: string;
}

export interface DeleteFileResponse {
    success: boolean;
    message: string;
}
// #endregion

//#region User API Types
export interface GetUserPayload {
    userId: string;
}

export interface GetUserResponse {
    id: string;
    email: string;
    name: string;
    // Add other user fields
}

// #endregion

//#region Team API Types
export interface CreateTeamPayload {
    name: string;
    description?: string;
    city?: string;
    country?: string;
    logo?: string;
}

export interface CreateTeamResponse {
    id: string;
    name: string;
    description: string;
    city: string;
    country: string;
    logo: string;
    createdAt: string;
}

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

export interface GetTeamLogosResponse {
    teams: TeamData[];
}

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
