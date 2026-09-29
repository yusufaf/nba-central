import { useEventListener } from "@vueuse/core";
import type { HistoryAction, TeamDetails } from "@/composables/useTeamHistory";

export type DetailField = keyof TeamDetails;

type Labels = Pick<HistoryAction, "undoLabel" | "redoLabel">;

const TEXT_FIELDS: ReadonlySet<DetailField> = new Set(["name", "description", "city", "country"]);
const STAFF_ROLES: Partial<Record<DetailField, string>> = { coach: "coach", arena: "arena", gm: "GM" };
const NOUNS: Record<DetailField, string> = {
    name: "team name",
    description: "team description",
    city: "city",
    country: "country",
    logo: "team logo",
    jersey: "team jersey",
    coach: "coach",
    arena: "arena",
    gm: "GM",
};

// JerseyDrawingCanvas writes the finished drawing as a data: URL after every
// stroke; picked jerseys are CDN URLs.
const isDrawnJersey = (value: unknown) => typeof value === "string" && value.startsWith("data:");

// Hall of Famers carry a trailing "*" in the coaches data.
const staffName = (entity: unknown) =>
    ((entity as { name?: string } | null)?.name ?? "").replace(/\*$/, "").trim() || "unnamed";

const describeField = (field: DetailField, before: unknown, after: unknown): Labels => {
    const role = STAFF_ROLES[field];
    if (role) {
        return {
            undoLabel: before ? `Restored ${staffName(before)} as ${role}` : `Removed ${staffName(after)} as ${role}`,
            redoLabel: after ? `Changed ${role} to ${staffName(after)}` : `Removed ${staffName(before)} as ${role}`,
        };
    }

    const noun = NOUNS[field];
    let redoLabel: string;
    if (!after) redoLabel = field === "logo" || field === "jersey" ? `Removed ${noun}` : `Cleared ${noun}`;
    else if (field === "name") redoLabel = `Renamed team to ${after}`;
    else if (field === "city" || field === "country") redoLabel = `Changed ${noun} to ${after}`;
    else redoLabel = `Changed ${noun}`;
    return { undoLabel: `Restored ${noun}`, redoLabel };
};

/**
 * Toast text for undoing and redoing everything that differs between the
 * details an entry was taken from and where the edit leaves them - one field
 * for most edits, city and country together for a historical team pick.
 */
export const describeDetailEdit = (before: TeamDetails, after: TeamDetails, field: DetailField): Labels => {
    const changed = (Object.keys(NOUNS) as DetailField[]).filter((key) => before[key] !== after[key]);
    // A burst typed back to where it started still has to say something.
    if (changed.length <= 1) {
        const only = changed[0] ?? field;
        return describeField(only, before[only], after[only]);
    }

    const nouns = changed.map((key) => NOUNS[key]).join(" and ");
    const moved = changed.length === 2 && changed[0] === "city" && changed[1] === "country" && after.city && after.country;
    return {
        undoLabel: `Restored ${nouns}`,
        redoLabel: moved ? `Moved team to ${after.city}, ${after.country}` : `Changed ${nouns}`,
    };
};

interface DetailEditsOptions {
    details: () => TeamDetails;
    apply: (field: DetailField, value: unknown) => void;
    // Called just before every edit is applied, like any other undoable change.
    record: (action: HistoryAction) => void;
    // The details held by the entry a push with this key would fold into.
    baseFor: (mergeKey: string) => TeamDetails | undefined;
}

/**
 * Makes the Team Builder's detail edits (name, city, logo, coach...) undoable
 * alongside the roster, one entry per step the user would think of as one:
 *
 * - Typing: one entry per field per focus - leaving the field and coming back
 *   starts the next one.
 * - Drawing a jersey: one entry per visit to the customization dialog, not
 *   per stroke. Focus moving between the drawing controls inside it doesn't
 *   split it; focus landing back on the page, or a click there, does.
 * - Anything else written in the same tick joins the entry, which is how a
 *   historical team pick setting city and country undoes as one step.
 * - Every other edit is its own entry.
 */
export const useDetailEdits = ({ details, apply, record, baseFor }: DetailEditsOptions) => {
    let focusSession = 0;
    let pageFocusSession = 0;
    let editCount = 0;
    let tickKey: string | undefined;

    const isInOverlay = (target: EventTarget | null) =>
        target instanceof Element && target.closest("[role='dialog'], [role='alertdialog']") !== null;

    useEventListener(window, "focusin", (event: FocusEvent) => {
        focusSession++;
        if (!isInOverlay(event.target)) pageFocusSession++;
    });
    // Safari doesn't focus a clicked button, so closing the dialog can hand
    // focus back to <body> without a focusin; reopening it still takes a
    // click on the page.
    useEventListener(window, "pointerdown", (event: PointerEvent) => {
        if (!isInOverlay(event.target)) pageFocusSession++;
    });

    const mergeKeyFor = (field: DetailField, value: unknown) => {
        if (TEXT_FIELDS.has(field)) return `${field}:${focusSession}`;
        if (field === "jersey" && isDrawnJersey(value)) return `jersey:drawing:${pageFocusSession}`;
        return `${field}#${editCount}`;
    };

    const edit = (field: DetailField, value: unknown) => {
        const current = details();
        if (Object.is(current[field], value)) return;

        editCount++;
        if (tickKey === undefined) {
            tickKey = mergeKeyFor(field, value);
            queueMicrotask(() => {
                tickKey = undefined;
            });
        }
        const before = baseFor(tickKey) ?? current;
        record({ ...describeDetailEdit(before, { ...current, [field]: value }, field), mergeKey: tickKey });
        apply(field, value);
    };

    return { edit };
};
