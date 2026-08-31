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
    const positions = player.positions?.length
        ? player.positions
        : expandPosition(player.position);
    return positions.includes(position);
};
