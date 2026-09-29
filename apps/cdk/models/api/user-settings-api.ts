import { ApiResponse } from "./custom-entities-api";
import { SettingsMap } from "../user-settings";

export interface UpdateUserSettingsPayload {
	settings: SettingsMap;
	// Only create the map, never patch one that exists: the web client's
	// one-time upload of local values. If the map already exists, nothing is
	// written and the stored settings come back.
	initialize?: boolean;
}

export interface UserSettingsData {
	settings: SettingsMap;
	// null until the user's first write. The web client uses it to decide
	// whether to migrate its localStorage preferences up (once, ever).
	updatedAt: string | null;
}

export type GetUserSettingsResponse = ApiResponse<UserSettingsData>;
export type UpdateUserSettingsResponse = ApiResponse<UserSettingsData>;
