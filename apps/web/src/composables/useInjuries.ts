import { shallowRef } from "vue";
import { INJURIES_MAX_AGE_MS, INJURIES_REFRESH_MS } from "@/constants/liveData";
import type { InjuryKind, PlayerInjury } from "@/models/liveData";
import { getInjuries } from "@/network/liveData";

// One injuries.json shared by every card, like useHeadshots, but refetched
// every INJURIES_REFRESH_MS so an open tab follows the 15-minute refresh.
// Until a fresh file lands, or if it fails or is stale, cards show no injury.
const injuries = shallowRef<Record<string, PlayerInjury>>({});
let request: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
// When the shown file passes INJURIES_MAX_AGE_MS; null while nothing shows.
let expiresAt: number | null = null;
// Bumped by resetInjuries, so a response to a request from before the reset
// is dropped instead of refilling the cache and arming a second timer.
let generation = 0;

const KINDS: readonly InjuryKind[] = ["out", "day-to-day", "other"];

const isPlayerInjury = (value: unknown): value is PlayerInjury => {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.status === "string" &&
        entry.status !== "" &&
        KINDS.includes(entry.kind as InjuryKind) &&
        typeof entry.comment === "string" &&
        (entry.date === null || typeof entry.date === "string")
    );
};

const clear = () => {
    injuries.value = {};
    expiresAt = null;
};

// Never past the shown file's cutoff, so a failed or stale refetch can't keep
// a badge up beyond 12 hours.
const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    const delay = expiresAt === null ? ms : Math.min(ms, Math.max(0, expiresAt - Date.now()));
    timer = setTimeout(refresh, delay);
};

// A failed or stale fetch keeps what's shown until its own cutoff; the owner's
// rule is "hide once the file is over 12 hours old", in a tab left open too.
function refresh() {
    timer = null;
    if (expiresAt !== null && Date.now() >= expiresAt) clear();
    request = null;
    void load();
}

const load = () => {
    const current = generation;
    request ??= getInjuries()
        .then(({ generatedAt, players }) => {
            if (current !== generation) return;
            const age = Date.now() - Date.parse(generatedAt);
            // Strict, so an accepted file always has time left: at exactly
            // 12 hours a zero-delay timer would refetch the same file at once.
            if (!(age < INJURIES_MAX_AGE_MS)) {
                console.warn(`Ignoring injuries.json from ${generatedAt}: over 12 hours old`);
                clear();
                schedule(INJURIES_REFRESH_MS);
                return;
            }
            const next: Record<string, PlayerInjury> = {};
            for (const [id, entry] of Object.entries(players)) {
                if (isPlayerInjury(entry)) next[id] = entry;
            }
            injuries.value = next;
            // A file dated ahead of the visitor's clock gets the full window
            // from now, rather than a delay too large for setTimeout.
            expiresAt = Date.now() + INJURIES_MAX_AGE_MS - Math.max(0, age);
            schedule(INJURIES_REFRESH_MS);
        })
        .catch((err) => {
            if (current !== generation) return;
            console.error("Couldn't load injuries", err);
            schedule(INJURIES_REFRESH_MS);
        });
    return request;
};

/** The cached injury status for a Basketball-Reference id, if there is one. */
export const injuryFor = (playerId: string): PlayerInjury | undefined => {
    void load();
    return injuries.value[playerId];
};

/** Settles once the current injuries.json request has loaded or failed. */
export const injuriesLoaded = () => load();

export const resetInjuries = () => {
    generation++;
    if (timer) clearTimeout(timer);
    timer = null;
    clear();
    request = null;
};
