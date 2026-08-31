// Generic API response wrapper with discriminated union for type safety
export type ApiResponse<T = void> =
	| { success: true; data: T }
	| { success: false; error: string };

// ============================================================================
// GM API Types
// ============================================================================

// Payloads
export interface CreateCustomGMPayload {
	name: string;
	teams: string[];
}

export interface UpdateCustomGMPayload {
	gmUUID: string;
	name: string;
	teams: string[];
}

// Response data structures
export interface CustomGMData {
	gmUUID: string;
	name: string;
	teams: string[];
	created: string;
}

export interface UpdatedCustomGMData {
	gmUUID: string;
	name: string;
	teams: string[];
	updated: string;
}

export interface CustomGMListItem {
	gmUUID: string;
	name: string;
	teams: string[];
	created: string;
	isCustom: true;
}

export interface ListCustomGMsData {
	customGMs: CustomGMListItem[];
}

// Response types
export type CreateCustomGMResponse = ApiResponse<CustomGMData>;
export type ListCustomGMsResponse = ApiResponse<ListCustomGMsData>;
export type UpdateCustomGMResponse = ApiResponse<UpdatedCustomGMData>;
export type DeleteCustomGMResponse = ApiResponse<void>;

// ============================================================================
// Coach API Types
// ============================================================================

// Utility types
export type CoachSpecialty = 'Offensive' | 'Defensive' | 'Balanced';

// Payloads
export interface CreateCustomCoachPayload {
	name: string;
	overallRating: number;
	specialty: CoachSpecialty;
}

export interface UpdateCustomCoachPayload {
	coachUUID: string;
	name: string;
	overallRating: number;
	specialty: CoachSpecialty;
}

// Response data structures
export interface CustomCoachData {
	coachUUID: string;
	name: string;
	overallRating: number;
	specialty: CoachSpecialty;
	created: string;
}

export interface UpdatedCustomCoachData {
	coachUUID: string;
	name: string;
	overallRating: number;
	specialty: CoachSpecialty;
	updated: string;
}

export interface CustomCoachListItem {
	coachUUID: string;
	name: string;
	overallRating: number;
	specialty: CoachSpecialty;
	created: string;
	isCustom: true;
}

export interface ListCustomCoachesData {
	customCoaches: CustomCoachListItem[];
}

// Response types
export type CreateCustomCoachResponse = ApiResponse<CustomCoachData>;
export type ListCustomCoachesResponse = ApiResponse<ListCustomCoachesData>;
export type UpdateCustomCoachResponse = ApiResponse<UpdatedCustomCoachData>;
export type DeleteCustomCoachResponse = ApiResponse<void>;

// ============================================================================
// Player API Types
// ============================================================================

// Payloads
export interface CreateCustomPlayerPayload {
	name: string;
	position: string;
	heightFeet: number;
	heightInches: number;
	weightPounds: number;
	overallRating: number;
}

export interface UpdateCustomPlayerPayload {
	playerUUID: string;
	name: string;
	position: string;
	heightFeet: number;
	heightInches: number;
	weightPounds: number;
	overallRating: number;
}

// Response data structures
export interface CustomPlayerData {
	playerUUID: string;
	name: string;
	position: string;
	heightFeet: number;
	heightInches: number;
	weightPounds: number;
	overallRating: number;
	created: string;
}

export interface UpdatedCustomPlayerData {
	playerUUID: string;
	name: string;
	position: string;
	heightFeet: number;
	heightInches: number;
	weightPounds: number;
	overallRating: number;
	updated: string;
}

export interface CustomPlayerListItem {
	playerUUID: string;
	name: string;
	position: string;
	heightFeet: number;
	heightInches: number;
	weightPounds: number;
	overallRating: number;
	created: string;
	isCustom: true;
}

export interface ListCustomPlayersData {
	customPlayers: CustomPlayerListItem[];
}

// Response types
export type CreateCustomPlayerResponse = ApiResponse<CustomPlayerData>;
export type ListCustomPlayersResponse = ApiResponse<ListCustomPlayersData>;
export type UpdateCustomPlayerResponse = ApiResponse<UpdatedCustomPlayerData>;
export type DeleteCustomPlayerResponse = ApiResponse<void>;
