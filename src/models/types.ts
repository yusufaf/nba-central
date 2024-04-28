export type CustomizationKey =
    | "shortNames"
    | "hideScores"
    | "hideFinishedGames";

export type CustomizationState = Map<CustomizationKey, any>;
