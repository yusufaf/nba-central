import { readonly, shallowRef, type Ref } from "vue";
import { STANDINGS_REFRESH_MS } from "@/constants/liveData";
import { getStandings } from "@/network/liveData";
import { standingsByTeam, type TeamStanding } from "@/utils/standings";

export type StandingsState = "idle" | "loading" | "ready" | "error";

// One copy of standings.json for every score card tooltip on the page, loaded
// when the first one opens. Kept in a shallowRef so a refetch that replaces
// the map re-renders a tooltip that is already open.
const standings = shallowRef<Map<string, TeamStanding>>(new Map());
const state = shallowRef<StandingsState>("idle");
let request: Promise<void> | null = null;
let loadedAt: number | null = null;
// Bumped by resetStandings, so a load that was in flight is dropped.
let generation = 0;

export const standingsState: Readonly<Ref<StandingsState>> = readonly(state);

/**
 * Loads standings.json unless a load is in flight or the copy is fresh. Not
 * async: the state turns "loading" in the caller's tick, before a tooltip's
 * content first renders. A failed load leaves nothing cached, so the next
 * open tries again.
 */
export const loadStandings = (): Promise<void> => {
    if (request) return request;
    if (loadedAt !== null && Date.now() - loadedAt < STANDINGS_REFRESH_MS) return Promise.resolve();
    const current = generation;
    // A refetch keeps the lines on screen; only a first load shows "Loading...".
    if (!standings.value.size) state.value = "loading";
    request = getStandings()
        .then((file) => {
            if (current !== generation) return;
            standings.value = standingsByTeam(file);
            loadedAt = Date.now();
            state.value = "ready";
        })
        .catch((err) => {
            if (current !== generation) return;
            console.error("Couldn't load standings", err);
            state.value = standings.value.size ? "ready" : "error";
        })
        .finally(() => {
            if (current === generation) request = null;
        });
    return request;
};

/** A team's standing by ESPN team id, from what has loaded. Never fetches. */
export const standingFor = (espnId: string): TeamStanding | undefined => standings.value.get(espnId);

export const resetStandings = () => {
    generation++;
    standings.value = new Map();
    state.value = "idle";
    request = null;
    loadedAt = null;
};
