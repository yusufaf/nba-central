import { shallowRef } from "vue";
import { LIVE_DATA_BASE_URL } from "@/constants/liveData";
import { getHeadshots } from "@/network/liveData";

// One fetch of headshots.json per page load, shared by every card. Until it
// lands, or if it fails, cards keep their initials.
const urls = shallowRef<Record<string, string>>({});
let request: Promise<void> | null = null;

const load = () => {
    request ??= getHeadshots()
        .then(({ players }) => {
            const next: Record<string, string> = {};
            for (const [id, { image }] of Object.entries(players)) {
                if (typeof image === "string" && image) next[id] = `${LIVE_DATA_BASE_URL}/${image}`;
            }
            urls.value = next;
        })
        .catch((err) => {
            console.error("Couldn't load headshots", err);
        });
    return request;
};

/** The mirrored headshot for a Basketball-Reference id, if there is one. */
export const headshotUrl = (playerId: string): string | undefined => {
    void load();
    return urls.value[playerId];
};

/** Settles once headshots.json has loaded or failed. */
export const headshotsLoaded = () => load();

export const resetHeadshots = () => {
    urls.value = {};
    request = null;
};
