import { CoachSpecialty } from "./api/custom-entities-api";

// DynamoDB Item Types (database layer)
export interface CustomGMItem {
	PK: string;
	SK: string;
	entityType: string;
	created: string;
	updated: string;
	gmUUID: string;
	name: string;
	teams: string[];
	createdBy: string;
}

export interface CustomCoachItem {
	PK: string;
	SK: string;
	entityType: string;
	created: string;
	updated: string;
	coachUUID: string;
	name: string;
	overallRating: number;
	specialty: CoachSpecialty;
	createdBy: string;
}

export interface CustomPlayerItem {
	PK: string;
	SK: string;
	entityType: string;
	created: string;
	updated: string;
	playerUUID: string;
	name: string;
	position: string;
	heightFeet: number;
	heightInches: number;
	weightPounds: number;
	overallRating: number;
	createdBy: string;
}
