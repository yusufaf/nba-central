export const NBA_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

/**
 * 2K's API pads some positions lists with values that aren't positions: "N"
 * on 75 all-time players and "S" on two current ones, as of 2K27. Keeps the
 * real ones, in order.
 */
export const nbaPositions = (positions: readonly unknown[]): string[] =>
	positions.filter((p): p is string => (NBA_POSITIONS as readonly unknown[]).includes(p));
