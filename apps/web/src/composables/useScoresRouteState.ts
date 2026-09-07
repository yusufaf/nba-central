import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useScoresPreferences } from "./useScoresPreferences";
import { toIsoDate, parseIsoDate } from "@/utils/date";
import { VIEWS } from "@/constants/constants";

const CONFERENCE_VALUES = ["ALL", "EAST", "WEST", "CROSS"];
const VIEW_VALUES = [VIEWS.DEFAULT, VIEWS.LIST];

export interface ScoresRouteStateBounds {
    minDate: Date;
    maxDate: Date;
}

/**
 * Puts the Scores page's selected date, conference filter and view mode in
 * the URL (?date=YYYY-MM-DD&conf=EAST&view=List), so a scoreboard for a
 * specific day/filter combination can be linked or bookmarked. A query
 * param wins when present; useScoresPreferences (localStorage) supplies the
 * default when it's absent, and stays the source of truth for conf/view
 * across visits that don't carry a query at all.
 *
 * Uses router.replace, not push, matching TeamBuilder.vue's ?team= sync -
 * stepping through dates shouldn't fill the back-button stack. Reads via a
 * route.query watcher rather than onMounted for the same reason
 * TeamBuilder.vue does: navigating between /scores?date=A and a bare
 * /scores (e.g. the nav bar link) reuses this component instance, so
 * onMounted alone would miss it.
 */
export const useScoresRouteState = (bounds: ScoresRouteStateBounds) => {
    const route = useRoute();
    const router = useRouter();
    const { preferences } = useScoresPreferences();

    const setQuery = (patch: Record<string, string>) => {
        router.replace({ query: { ...route.query, ...patch } });
    };

    const selectedDate = computed<Date>({
        get: () => {
            const raw = route.query.date;
            if (typeof raw === "string") {
                const parsed = parseIsoDate(raw);
                if (parsed && parsed >= bounds.minDate && parsed <= bounds.maxDate) {
                    return parsed;
                }
            }
            return bounds.maxDate;
        },
        set: (value) => {
            // v-calendar's DatePicker emits null through v-model when a
            // day without `is-required` is re-clicked to deselect it -
            // toIsoDate(null) throws, so fall back to today rather than
            // crashing the page on a second click of the selected date.
            if (!(value instanceof Date)) {
                setQuery({ date: toIsoDate(bounds.maxDate) });
                return;
            }
            setQuery({ date: toIsoDate(value) });
        },
    });

    // An absent or invalid ?date= falls back to today silently in the
    // getter above - write it back so the URL a user is actually looking
    // at is always the shareable one, not just today's default.
    watch(
        () => route.query.date,
        (raw) => {
            const valid =
                typeof raw === "string" &&
                (() => {
                    const parsed = parseIsoDate(raw);
                    return !!parsed && parsed >= bounds.minDate && parsed <= bounds.maxDate;
                })();
            if (!valid) {
                setQuery({ date: toIsoDate(bounds.maxDate) });
            }
        },
        { immediate: true },
    );

    const conferenceFilter = computed<string>({
        get: () => {
            const raw = route.query.conf;
            if (typeof raw === "string" && CONFERENCE_VALUES.includes(raw)) {
                return raw;
            }
            return preferences.value.conferenceFilter;
        },
        set: (value) => {
            preferences.value.conferenceFilter = value;
            setQuery({ conf: value });
        },
    });

    const selectedView = computed<string>({
        get: () => {
            const raw = route.query.view;
            if (typeof raw === "string" && VIEW_VALUES.includes(raw)) {
                return raw;
            }
            return preferences.value.selectedView;
        },
        set: (value) => {
            preferences.value.selectedView = value;
            setQuery({ view: value });
        },
    });

    return {
        selectedDate,
        conferenceFilter,
        selectedView,
    };
};
