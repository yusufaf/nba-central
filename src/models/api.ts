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
// #endregion
