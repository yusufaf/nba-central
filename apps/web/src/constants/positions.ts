/**
 * Basketball-Reference files players under coarse positions ("G", "F", "F-C"),
 * so filtering the pool by PG/SG/SF/PF/C matched nothing. NBA 2K's `positions`
 * are already specific and win when present; this expansion is the fallback
 * for the majority of the pool that 2K doesn't rate.
 */
const BBREF_POSITION_EXPANSION: Record<string, string[]> = {
    G: ['PG', 'SG'],
    F: ['SF', 'PF'],
    C: ['C'],
};

export const NBA_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

/**
 * 2K's API pads some positions lists with values that aren't positions ("N",
 * "S"). apps/cdk drops them now, but a cached ratings file or a stored Cap Five
 * result from before that can still hold them.
 */
export const nbaPositions = (positions: readonly string[]): string[] =>
    positions.filter((p) => (NBA_POSITIONS as readonly string[]).includes(p));

export const expandPosition = (position?: string): string[] => {
    const parts = (position || '').toUpperCase().split('-');
    const expanded = new Set<string>();
    for (const part of parts) {
        // Already specific (PG/SG/SF/PF/C) - keep as-is.
        if (part.length === 2 || part === 'C') expanded.add(part);
        for (const p of BBREF_POSITION_EXPANSION[part] || []) expanded.add(p);
    }
    return [...expanded];
};

export const playsPosition = (
    player: { position?: string; positions?: string[] },
    position: string,
): boolean => {
    const specific = nbaPositions(player.positions ?? []);
    const positions = specific.length ? specific : expandPosition(player.position);
    return positions.includes(position);
};
