import type { PlayerRecord } from "@/models/api";
import type { Player } from "@/models/types";

/**
 * A getPlayers record as the builder holds it: with the `fullName` a saved
 * roster entry needs (the server rejects a snapshot without one) and the
 * "6' 6", 216lbs" line the cards show.
 */
export const toBuilderPlayer = (record: PlayerRecord): Player => {
    const { first_name, last_name, height_feet, height_inches, weight_pounds } = record;
    const height = height_feet && height_inches ? `${height_feet}' ${height_inches}"` : "N/A";
    const weight = weight_pounds ? `${weight_pounds}lbs` : "N/A";
    return {
        ...record,
        fullName: `${first_name} ${last_name}`,
        heightAndWeight: `${height}, ${weight}`,
    } as Player;
};

/**
 * The drawer's Team Name sort. Players on no roster (free agents, retirees,
 * custom players) sink in both directions, as unrated players do under Rating.
 */
export const compareTeamNames = (
    a: Pick<Player, "team">,
    b: Pick<Player, "team">,
    modifier: 1 | -1,
): number => {
    const aName = a.team?.full_name || "";
    const bName = b.team?.full_name || "";
    if (!aName && !bName) return 0;
    if (!aName) return 1;
    if (!bName) return -1;
    return modifier * aName.localeCompare(bName);
};
