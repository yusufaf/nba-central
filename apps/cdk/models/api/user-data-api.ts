import { ApiResponse } from "./custom-entities-api";
import { SettingsMap } from "../user-settings";

// An exported item is the stored one minus the table keys (PK, SK, PK2,
// SK2) and the owner's id, which the export carries once in `user.id`.
export type ExportedItem = Record<string, unknown>;

// Bump `version` on any change a reader of an older file would trip on.
export interface UserDataExport {
	version: 1;
	exportedAt: string;
	user: { id: string; username: string | null };
	settings: SettingsMap;
	settingsUpdatedAt: string | null;
	// The uploaded avatar, by URL. Share cards are on each team's cardUrl.
	avatarUrl: string | null;
	// Full items, rosters included, not the list projection.
	teams: ExportedItem[];
	customCoaches: ExportedItem[];
	customGMs: ExportedItem[];
	customPlayers: ExportedItem[];
	// With their court settings and image URLs.
	customArenas: ExportedItem[];
	// Anything else under the user's partition, so a kind added later is
	// never silently left out.
	other: ExportedItem[];
}

export type ExportUserDataResponse = ApiResponse<UserDataExport>;

export interface DeleteUserDataResult {
	deletedItems: number;
	deletedFiles: number;
}

export type DeleteUserDataResponse = ApiResponse<DeleteUserDataResult>;
