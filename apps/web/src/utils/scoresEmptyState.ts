export type ScoresEmptyReason = "none" | "no-games" | "conference" | "all-finished";

export interface ScoresEmptyInput {
    /** Games ESPN returned for the date, before any filtering. */
    totalGames: number;
    /** Games left after the conference filter. */
    filteredGames: number;
    /** Games left after Hide Finished Games is applied on top of the filter. */
    visibleGames: number;
}

/**
 * Why the score grid is empty, or "none" when there is something to render.
 * When more than one cause applies, report the earliest stage that emptied the
 * list: the user's next action depends on which stage that was.
 */
export function getScoresEmptyReason(input: ScoresEmptyInput): ScoresEmptyReason {
    if (input.totalGames === 0) return "no-games";
    if (input.filteredGames === 0) return "conference";
    if (input.visibleGames === 0) return "all-finished";
    return "none";
}
