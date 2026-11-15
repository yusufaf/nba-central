import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { CustomCoachItem, CustomGMItem } from "models/custom-entities";
import { EntityRef, ResolvedEntity } from "models/api/teams-api";
import { userPartitionKey } from "./user-data";

// A team's coach and GM, the way resources/dynamo/arenas.ts handles its arena:
// a custom one links to the owner's own item by uuid, and the item's name and
// look are read live (spec: docs/superpowers/specs/2026-11-05-3d-builders-design.md).

export type StaffRole = "coach" | "gm";
type StaffItem = CustomCoachItem | CustomGMItem;

export const STAFF_SK_PREFIX: Record<StaffRole, string> = { coach: "customCoach#", gm: "customGM#" };

export const customStaffKey = (userUUID: string, role: StaffRole, uuid: string) => ({
	PK: userPartitionKey(userUUID),
	SK: `${STAFF_SK_PREFIX[role]}${uuid}`,
});

/** The coach or GM only if it's in this user's own partition. */
export const getCustomStaff = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	userUUID: string,
	role: StaffRole,
	uuid: string,
): Promise<StaffItem | null> => {
	const { Item } = await docClient.send(
		new GetCommand({ TableName: tableName, Key: customStaffKey(userUUID, role, uuid) }),
	);
	return (Item as StaffItem | undefined) ?? null;
};

const nonEmpty = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

// The link id under any of the names a ref has carried: uuid (an EntityRef),
// or coachUUID/gmUUID (a raw Coach or GM a client sent back).
const refId = (ref: Record<string, unknown>): string | undefined =>
	nonEmpty(ref.uuid) ?? nonEmpty(ref.coachUUID) ?? nonEmpty(ref.gmUUID);

// Only the fields a team stores. Anything else on a client's ref, or on a
// row saved before the server cleaned refs (an appearance included), goes.
const toRef = (ref: EntityRef): EntityRef => {
	const isCustom = ref.isCustom === true;
	const uuid = isCustom ? refId(ref as unknown as Record<string, unknown>) : undefined;
	return { name: ref.name, isCustom, ...(uuid && { uuid }) };
};

const itemUUID = (role: StaffRole, item: StaffItem) =>
	role === "coach" ? (item as CustomCoachItem).coachUUID : (item as CustomGMItem).gmUUID;

const refFromItem = (role: StaffRole, item: StaffItem): EntityRef => ({
	name: item.name,
	isCustom: true,
	uuid: itemUUID(role, item),
});

const resolveFromItem = (role: StaffRole, item: StaffItem): ResolvedEntity => ({
	...refFromItem(role, item),
	...(item.appearance && { appearance: item.appearance }),
});

/**
 * What createTeam/updateTeam store for a coach or GM, and what they return.
 * A link is kept only for the caller's own item, and its name is copied from
 * it. Otherwise (a deleted item, or a remix of someone else's team) the link
 * is dropped and the name kept.
 */
export const toStoredEntityRef = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	callerUUID: string,
	role: StaffRole,
	ref: EntityRef | null | undefined,
): Promise<{ stored: EntityRef | null; resolved: ResolvedEntity | null }> => {
	if (ref == null) return { stored: null, resolved: null };
	const clean = toRef(ref);
	if (!clean.uuid) return { stored: clean, resolved: clean };

	const item = await getCustomStaff(docClient, tableName, callerUUID, role, clean.uuid);
	if (item) return { stored: refFromItem(role, item), resolved: resolveFromItem(role, item) };

	const unlinked = { name: clean.name, isCustom: true };
	return { stored: unlinked, resolved: unlinked };
};

/**
 * What getTeam/getPublicTeam return for a coach or GM. The lookup always uses
 * the team's owner, never the viewer. A missing item is a figurine: the
 * stored ref, with no look.
 */
export const resolveEntity = async (
	docClient: DynamoDBDocumentClient,
	tableName: string,
	ownerUUID: string,
	role: StaffRole,
	ref: EntityRef | null | undefined,
): Promise<ResolvedEntity | null> => {
	if (ref == null) return null;
	const clean = toRef(ref);
	if (!clean.uuid) return clean;
	const item = await getCustomStaff(docClient, tableName, ownerUUID, role, clean.uuid);
	return item ? resolveFromItem(role, item) : clean;
};
