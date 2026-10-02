import { ApiResponse } from "./custom-entities-api";

export interface UserStats {
	teams: number;
	publishedTeams: number;
	customCoaches: number;
	customGMs: number;
	customPlayers: number;
}

export type GetUserStatsResponse = ApiResponse<UserStats>;

export interface UploadAvatarPayload {
	// Base64 image bytes. The type is read from the bytes themselves.
	image: string;
}

export type UploadAvatarResponse = ApiResponse<{ avatarUrl: string }>;
