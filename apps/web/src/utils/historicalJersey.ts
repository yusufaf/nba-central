import historicalJerseysData from "@/assets/data/historicalJerseys.json";
import type { HistoricalJersey } from "@/models/types";

const historicalJerseys = historicalJerseysData as HistoricalJersey[];

/**
 * The Wix media id stem of a jersey image URL (`31d308_…`), or null. Mirrors
 * `mediaIdFromJerseyUrl` in apps/cdk/scripts/lib/dailyEraPuzzles.ts, which
 * names each Daily Era puzzle's jersey by the same id.
 */
export const mediaIdFromJerseyUrl = (url: string): string | null => {
    const stem = url.split("/").pop()?.replace(/\.[^.]*$/, "") ?? "";
    return /^[A-Za-z0-9_]+$/.test(stem) ? stem : null;
};

let byMediaId: Map<string, HistoricalJersey> | null = null;

// Every row, not only home/road: the builder's ?jersey= takes any of them.
export const findHistoricalJersey = (mediaId: string): HistoricalJersey | undefined => {
    if (!byMediaId) {
        byMediaId = new Map();
        for (const row of historicalJerseys) {
            const id = mediaIdFromJerseyUrl(row.jersey);
            if (id) byMediaId.set(id, row);
        }
    }
    return byMediaId.get(mediaId);
};
