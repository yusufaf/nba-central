import { ApiResponse } from "./custom-entities-api";
import { SettingsMap } from "../user-settings";

export interface UpdateUserSettingsPayload {
	settings: SettingsMap;
}

export interface UserSettingsData {
	settings: SettingsMap;
	// null until the user's first write. The web client uses it to decide
	// whether to migrate its localStorage preferences up (once, ever).
	updatedAt: string | null;
}

export type GetUserSettingsResponse = ApiResponse<UserSettingsData>;
export type UpdateUserSettingsResponse = ApiResponse<UserSettingsData>;
