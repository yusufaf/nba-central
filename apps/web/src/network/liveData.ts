import { LIVE_DATA_BASE_URL } from "@/constants/liveData";
import type { HeadshotsFile, ScheduleFile, StandingsFile } from "@/models/liveData";

// Plain fetch, not the axios `api`: these are public files on the CDN, so no
// /api base URL and no auth header. ESPN is never called from the browser.
const getLiveFile = async <T>(name: string, isValid: (body: Record<string, unknown>) => boolean): Promise<T> => {
    const res = await fetch(`${LIVE_DATA_BASE_URL}/${name}.json`);
    if (!res.ok) throw new Error(`${name}.json returned ${res.status}`);
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new Error(`${name}.json is not an object`);
    }
    const record = body as Record<string, unknown>;
    if (record.version !== 1 || !isValid(record)) {
        throw new Error(`${name}.json is not a version 1 file`);
    }
    return body as T;
};

export const getStandings = () =>
    getLiveFile<StandingsFile>("standings", (body) => Array.isArray(body.conferences));

export const getSchedule = () =>
    getLiveFile<ScheduleFile>("schedule", (body) => Array.isArray(body.games));

export const getHeadshots = () =>
    getLiveFile<HeadshotsFile>(
        "headshots",
        (body) => typeof body.players === "object" && body.players !== null,
    );
