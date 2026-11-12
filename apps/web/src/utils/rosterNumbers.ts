// Jersey numbers the owner sets per roster slot. "0" to "99" and "00"; a
// leading zero on anything else ("07") isn't a real jersey number. The server
// checks the same pattern (apps/cdk utilities/custom-entities-validation.ts).
export const JERSEY_NUMBER = /^(?:00|0|[1-9][0-9]?)$/;

export const isJerseyNumber = (value: unknown): value is string =>
    typeof value === 'string' && JERSEY_NUMBER.test(value);

/**
 * What a number field keeps of what was typed or pasted: digits only, at most
 * two, and a leading zero dropped unless it's 00 ("07" is 7, "070" is 70).
 * Always empty or a jersey number.
 */
export const cleanNumber = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    return (/^0[1-9]/.test(digits) ? digits.slice(1) : digits).slice(0, 2);
};

/** A rostered player as the numbers editor lists them. */
export interface RosterRow {
    slot: number;
    label: string;
    name: string;
}

/** Slot to number. Stored per slot; the builder moves a number with its player. */
export type RosterNumbers = Readonly<Record<number, string>>;

export const rosterNumbers = (roster: readonly { slot: number; number?: unknown }[]): RosterNumbers => {
    const numbers: Record<number, string> = {};
    for (const entry of roster) {
        if (isJerseyNumber(entry.number)) numbers[entry.slot] = entry.number;
    }
    return numbers;
};

export const withNumber = (numbers: RosterNumbers, slot: number, value: string | null): RosterNumbers => {
    const next = value || undefined;
    if (numbers[slot] === next) return numbers;
    const copy: Record<number, string> = { ...numbers };
    if (next === undefined) delete copy[slot];
    else copy[slot] = next;
    return copy;
};

export const swapNumbers = (numbers: RosterNumbers, a: number, b: number): RosterNumbers => {
    const first = numbers[a];
    const second = numbers[b];
    if (first === undefined && second === undefined) return numbers;
    return withNumber(withNumber(numbers, a, second ?? null), b, first ?? null);
};
