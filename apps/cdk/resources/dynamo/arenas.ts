import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { CustomArenaItem } from "models/custom-entities";
import { CustomArenaListItem } from "models/api/custom-entities-api";
import { ResolvedArena, TeamArenaRef } from "models/api/teams-api";
import { userPartitionKey } from "./user-data";

export const CUSTOM_ARENA_SK_PREFIX = "customArena#";

export const customArenaKey = (userUUID: string, arenaUUID: string) => ({
	PK: userPartitionKey(userUUID),
	SK: `${CUSTOM_ARENA_SK_PREFIX}${arenaUUID}`,
});

/**
 * The arena only if it's in this user's own partition. Every ownership check
 * goes through here: an arenaUUID from a request is never trusted on its own.
 */
export const getCustomArena = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	userUUID: string,
	arenaUUID: string,
): Promise<CustomArenaItem | null> => {
	const { Item } = await docClient.send(
		new GetCommand({ TableName: tableName, Key: customArenaKey(userUUID, arenaUUID) }),
	);
	return (Item as CustomArenaItem | undefined) ?? null;
};

const optional = <T>(value: T | null | undefined) => (value == null ? undefined : value);

export const toArenaListItem = (item: CustomArenaItem): CustomArenaListItem => ({
	arenaUUID: item.arenaUUID,
	name: item.name,
	location: item.location ?? "",
	capacity: item.capacity ?? null,
	openedYear: item.openedYear ?? null,
	court: item.court ?? null,
	photoUrl: optional(item.photoUrl),
	logoUrl: optional(item.logoUrl),
	drawingUrl: optional(item.drawingUrl),
	created: item.created,
	isCustom: true,
});

// Drops undefined fields, so the stored map and the JSON only carry what's set.
const compact = <T extends object>(value: T): T =>
	Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

// Only the fields a team stores. A client sending back a resolved arena
// (court, photoUrl, missing) gets those dropped here.
const toRef = (ref: TeamArenaRef): TeamArenaRef =>
	compact({
		name: ref.name,
		location: optional(ref.location),
		capacity: optional(ref.capacity),
		openedYear: optional(ref.openedYear),
		imgLink: optional(ref.imgLink),
		isCustom: optional(ref.isCustom),
		arenaUUID: optional(ref.arenaUUID),
	});

// The text copy a team keeps of a linked arena, taken from the item.
const refFromItem = (item: CustomArenaItem): TeamArenaRef =>
	compact({
		name: item.name,
		location: item.location || undefined,
		capacity: optional(item.capacity),
		openedYear: optional(item.openedYear),
		isCustom: true,
		arenaUUID: item.arenaUUID,
	});

const resolveFromItem = (item: CustomArenaItem): ResolvedArena =>
	compact({
		...refFromItem(item),
		court: optional(item.court),
		photoUrl: optional(item.photoUrl),
		logoUrl: optional(item.logoUrl),
		drawingUrl: optional(item.drawingUrl),
	});

/**
 * What createTeam/updateTeam store for the arena, and what they return.
 * A link is kept only when the arena is in the caller's own partition; then
 * its text is copied from the item. Otherwise (a deleted arena, or a remix of
 * someone else's team) the link is dropped and the client's text kept.
 */
export const toStoredArenaRef = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	callerUUID: string,
	ref: TeamArenaRef | null | undefined,
): Promise<{ stored: TeamArenaRef | null; resolved: ResolvedArena | null }> => {
	if (!ref) return { stored: null, resolved: null };
	const clean = toRef(ref);
	if (!clean.arenaUUID) return { stored: clean, resolved: clean };

	const item = await getCustomArena(docClient, tableName, callerUUID, clean.arenaUUID);
	if (item) return { stored: refFromItem(item), resolved: resolveFromItem(item) };

	const { arenaUUID: _dropped, imgLink: _builtInOnly, ...text } = clean;
	const unlinked = { ...text, isCustom: true };
	return { stored: unlinked, resolved: unlinked };
};

/**
 * What getTeam/getPublicTeam return for the arena. The lookup always uses
 * the team's owner, never the viewer. The live item's details replace the
 * stored copy, which is only the fallback once the arena is gone.
 */
export const resolveArena = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	ownerUUID: string,
	ref: TeamArenaRef | null | undefined,
): Promise<ResolvedArena | null> => {
	if (!ref) return null;
	if (!ref.arenaUUID) return ref;
	const item = await getCustomArena(docClient, tableName, ownerUUID, ref.arenaUUID);
	return item ? resolveFromItem(item) : { ...ref, missing: true };
};
