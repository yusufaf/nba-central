import { ASSETS_CDN_BASE_URL, LIVE_DATA_BASE_URL } from "@/constants/liveData";
import type { TeamSeasonFile, TeamSeasonsIndex } from "@/models/teamSeasons";

// Plain fetch of public CDN files, like network/liveData.ts. Each file is
// fetched once per page load: finished seasons never change, and the index
// and the current season change at most weekly.

const getJson = async <T>(url: string, listKey: "seasons" | "teams"): Promise<T> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    const body: unknown = await res.json();
    const record = body as Record<string, unknown> | null;
    if (!record || record.version !== 1 || !Array.isArray(record[listKey])) {
        throw new Error(`${url} is not a version 1 team-seasons file`);
    }
    return body as T;
};

// A failed fetch is forgotten, so the next call tries again.
const once = <T>(load: () => Promise<T>) => {
    let pending: Promise<T> | null = null;
    return () => {
        pending ??= load().catch((err) => {
            pending = null;
            throw err;
        });
        return pending;
    };
};

export const getTeamSeasonsIndex = once(() =>
    getJson<TeamSeasonsIndex>(`${LIVE_DATA_BASE_URL}/team-seasons/index.json`, "seasons"),
);

const loadCurrentTeamSeason = once(() =>
    getJson<TeamSeasonFile>(`${LIVE_DATA_BASE_URL}/team-seasons/current.json`, "teams"),
);

// null when the current season has no file yet (before opening night) or it
// can't be read: the picker then offers finished seasons only. The failure
// isn't kept, so the next call (the picker's Try again) asks again.
export const getCurrentTeamSeason = (): Promise<TeamSeasonFile | null> =>
    loadCurrentTeamSeason().catch((err) => {
        console.warn("No current team season", err);
        return null;
    });

const seasonFiles = new Map<string, () => Promise<TeamSeasonFile>>();

/** A finished season's file, by its index `path` ("team-seasons/NBA-1996.json"). */
export const getTeamSeasonFile = (path: string): Promise<TeamSeasonFile> => {
    let load = seasonFiles.get(path);
    if (!load) {
        load = once(() => getJson<TeamSeasonFile>(`${ASSETS_CDN_BASE_URL}/${path}`, "teams"));
        seasonFiles.set(path, load);
    }
    return load();
};
