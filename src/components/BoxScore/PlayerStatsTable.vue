<template>
    <Card>
        <CardHeader class="pb-0.5rem py-0.75rem" style="border-bottom: 2px solid hsl(var(--primary) / 0.3);">
            <div class="flex items-center gap-0.5rem">
                <img
                    :src="team.logo"
                    :alt="team.abbreviation"
                    style="width: 2rem; height: 2rem;"
                    class="object-contain shrink-0"
                />
                <h3 class="font-bold" style="font-size: 1rem;">{{ team.displayName }}</h3>
            </div>
        </CardHeader>
        <CardContent class="p-0 overflow-x-auto">
            <Table>
                <TableHeader class="sticky top-0 bg-background z-10">
                    <TableRow class="bg-primary/5" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: hsl(var(--foreground) / 0.6);">
                        <TableHead class="w-[10rem] sticky left-0 bg-primary/5 font-semibold" style="padding-top: 0.35rem; padding-bottom: 0.35rem;">
                            <button @click="sortBy('name')" class="flex items-center font-semibold" style="gap: 0.25rem; color: hsl(var(--foreground) / 0.6);">
                                Player
                                <SortIcon :active="sortColumn === 'name'" :direction="sortDirection" />
                            </button>
                        </TableHead>
                        <TableHead
                            v-for="(statName, index) in statistics.names"
                            :key="statName"
                            class="text-center min-w-[2.5rem] font-semibold" style="padding-top: 0.35rem; padding-bottom: 0.35rem;"
                        >
                            <button
                                @click="sortBy(index)"
                                class="flex items-center justify-center w-full font-semibold" style="gap: 0.25rem; color: hsl(var(--foreground) / 0.6);"
                            >
                                {{ statName }}
                                <SortIcon :active="sortColumn === index" :direction="sortDirection" />
                            </button>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <!-- Starters -->
                    <template v-if="starters.length > 0">
                        <TableRow>
                            <TableCell
                                colspan="100%"
                                class="text-primary bg-primary/6 py-0.25rem"
                                style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;"
                            >
                                Starters
                            </TableCell>
                        </TableRow>
                        <TableRow
                            v-for="(player, rowIndex) in starters"
                            :key="player.athlete.id"
                            class="hover:bg-muted/50 transition-colors"
                            :class="{ 'bg-white/[0.015]': rowIndex % 2 === 1 }"
                        >
                            <TableCell class="sticky left-0 bg-background py-0.25rem" :class="{ 'bg-white/[0.015]': rowIndex % 2 === 1 }">
                                <div class="flex items-center gap-0.375rem">
                                    <img
                                        v-if="player.athlete.headshot?.href"
                                        :src="player.athlete.headshot.href"
                                        :alt="player.athlete.displayName"
                                        style="width: 1.5rem; height: 1.5rem;"
                                        class="rounded-full object-cover shrink-0"
                                    />
                                    <div class="flex flex-col">
                                        <span class="leading-tight" style="font-size: 0.8rem; font-weight: 600;">{{ player.athlete.displayName }}</span>
                                        <span class="leading-tight" style="font-size: 0.65rem; color: hsl(var(--foreground) / 0.4);">
                                            {{ player.athlete.position?.abbreviation }} · #{{ player.athlete.jersey }}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell
                                v-for="(stat, index) in player.stats"
                                :key="index"
                                class="text-center py-0.25rem"
                                :class="getCellClass(player, index, stat)"
                                style="font-size: 0.8rem;"
                            >
                                {{ stat }}
                            </TableCell>
                        </TableRow>
                    </template>

                    <!-- Bench -->
                    <template v-if="bench.length > 0">
                        <TableRow>
                            <TableCell
                                colspan="100%"
                                class="text-primary bg-primary/6 py-0.25rem"
                                style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;"
                            >
                                Bench
                            </TableCell>
                        </TableRow>
                        <TableRow
                            v-for="(player, rowIndex) in bench"
                            :key="player.athlete.id"
                            class="hover:bg-muted/50 transition-colors"
                            :class="{ 'bg-white/[0.015]': rowIndex % 2 === 1 }"
                        >
                            <TableCell class="sticky left-0 bg-background py-0.25rem" :class="{ 'bg-white/[0.015]': rowIndex % 2 === 1 }">
                                <div class="flex items-center gap-0.375rem">
                                    <img
                                        v-if="player.athlete.headshot?.href"
                                        :src="player.athlete.headshot.href"
                                        :alt="player.athlete.displayName"
                                        style="width: 1.5rem; height: 1.5rem;"
                                        class="rounded-full object-cover shrink-0"
                                    />
                                    <div class="flex flex-col">
                                        <span class="leading-tight" style="font-size: 0.8rem; font-weight: 600;">{{ player.athlete.displayName }}</span>
                                        <span class="leading-tight" style="font-size: 0.65rem; color: hsl(var(--foreground) / 0.4);">
                                            {{ player.athlete.position?.abbreviation }} · #{{ player.athlete.jersey }}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell
                                v-for="(stat, index) in player.stats"
                                :key="index"
                                class="text-center py-0.25rem"
                                :class="getCellClass(player, index, stat)"
                                style="font-size: 0.8rem;"
                            >
                                {{ stat }}
                            </TableCell>
                        </TableRow>
                    </template>

                    <!-- DNP Players — collapsed -->
                    <template v-if="dnpPlayers.length > 0">
                        <TableRow>
                            <TableCell colspan="100%" class="py-0.25rem bg-muted/20">
                                <button
                                    @click="dnpExpanded = !dnpExpanded"
                                    class="flex items-center justify-between w-full hover:text-foreground transition-colors"
                                    style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: hsl(var(--foreground) / 0.6);"
                                >
                                    <span>Did Not Play ({{ dnpPlayers.length }})</span>
                                    <span>{{ dnpExpanded ? '▾' : '▸' }}</span>
                                </button>
                            </TableCell>
                        </TableRow>
                        <template v-if="dnpExpanded">
                            <TableRow
                                v-for="player in dnpPlayers"
                                :key="player.athlete.id"
                                class="opacity-50"
                            >
                                <TableCell class="sticky left-0 bg-background py-0.125rem">
                                    <span style="font-size: 0.8rem; font-weight: 500;">
                                        {{ player.athlete.displayName }}
                                        <span style="font-size: 0.65rem; color: hsl(var(--foreground) / 0.4);">
                                            · {{ player.athlete.position?.abbreviation }}
                                            <span v-if="player.reason"> — {{ player.reason }}</span>
                                        </span>
                                    </span>
                                </TableCell>
                                <TableCell colspan="100%" class="text-center italic" style="font-size: 0.75rem; color: hsl(var(--foreground) / 0.4);">
                                    DNP
                                </TableCell>
                            </TableRow>
                        </template>
                    </template>

                    <!-- Team Totals -->
                    <TableRow class="bg-primary/6" style="border-top: 2px solid hsl(var(--primary) / 0.2);">
                        <TableCell class="sticky left-0 bg-primary/6 py-0.5rem text-foreground font-bold" style="font-size: 0.65rem;">Team Totals</TableCell>
                        <TableCell
                            v-for="(total, index) in statistics.totals"
                            :key="index"
                            class="text-center py-0.5rem text-foreground font-bold"
                            style="font-size: 0.65rem;"
                        >
                            {{ total || '-' }}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ESPNTeamInfo, ESPNPlayerStatistics, ESPNPlayerStat } from '@/models/types';

interface Props {
    team: ESPNTeamInfo;
    statistics: ESPNPlayerStatistics;
    isAwayTeam?: boolean;
}

const props = defineProps<Props>();

const sortColumn = ref<number | 'name' | null>(null);
const sortDirection = ref<'asc' | 'desc'>('desc');
const dnpExpanded = ref(false);

// Sort Icon Component
const SortIcon = defineComponent({
    name: 'SortIcon',
    props: {
        active: { type: Boolean, required: true },
        direction: { type: String, required: true },
    },
    setup(props) {
        return () => {
            if (!props.active) {
                return h('svg', {
                    xmlns: 'http://www.w3.org/2000/svg',
                    style: 'width: 0.625rem; height: 0.625rem; opacity: 0.3;',
                    fill: 'none',
                    viewBox: '0 0 24 24',
                    stroke: 'currentColor',
                }, [
                    h('path', {
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                        'stroke-width': '2',
                        d: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4',
                    }),
                ]);
            }
            if (props.direction === 'asc') {
                return h('svg', {
                    xmlns: 'http://www.w3.org/2000/svg',
                    style: 'width: 0.625rem; height: 0.625rem;',
                    fill: 'none',
                    viewBox: '0 0 24 24',
                    stroke: 'currentColor',
                }, [
                    h('path', {
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                        'stroke-width': '2',
                        d: 'M5 15l7-7 7 7',
                    }),
                ]);
            }
            return h('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                style: 'width: 0.625rem; height: 0.625rem;',
                fill: 'none',
                viewBox: '0 0 24 24',
                stroke: 'currentColor',
            }, [
                h('path', {
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                    'stroke-width': '2',
                    d: 'M19 9l-7 7-7-7',
                }),
            ]);
        };
    },
});

// Group players by starter/bench/dnp
const starters = computed(() =>
    sortedPlayers.value.filter(p => p.starter && !p.didNotPlay)
);

const bench = computed(() =>
    sortedPlayers.value.filter(p => !p.starter && !p.didNotPlay)
);

const dnpPlayers = computed(() =>
    props.statistics.athletes.filter(p => p.didNotPlay)
);

const sortedPlayers = computed(() => {
    const players = [...props.statistics.athletes.filter(p => !p.didNotPlay)];
    if (sortColumn.value === null) return players;

    return players.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortColumn.value === 'name') {
            aValue = a.athlete.displayName;
            bValue = b.athlete.displayName;
        } else if (typeof sortColumn.value === 'number') {
            const aStatStr = a.stats[sortColumn.value];
            const bStatStr = b.stats[sortColumn.value];
            aValue = parseStatValue(aStatStr);
            bValue = parseStatValue(bStatStr);
        }

        if (sortDirection.value === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });
});

// Find column leaders for highlighting
const columnLeaders = computed(() => {
    const leaders: Record<number, number> = {};
    props.statistics.names.forEach((_, index) => {
        const values = props.statistics.athletes
            .filter(p => !p.didNotPlay)
            .map(p => parseStatValue(p.stats[index]));
        leaders[index] = Math.max(...values);
    });
    return leaders;
});

const parseStatValue = (stat: string): number => {
    if (!stat || stat === '-') return 0;
    if (stat.includes('-')) {
        const [made] = stat.split('-').map(Number);
        return made;
    }
    if (stat.startsWith('+') || stat.startsWith('-')) {
        return parseFloat(stat);
    }
    return parseFloat(stat) || 0;
};

const isColumnLeader = (player: ESPNPlayerStat, columnIndex: number): boolean => {
    const value = parseStatValue(player.stats[columnIndex]);
    return value > 0 && value === columnLeaders.value[columnIndex];
};

const plusMinusIndex = computed(() => props.statistics.names.indexOf('+/-'));

const getCellClass = (player: ESPNPlayerStat, columnIndex: number, stat: string): string => {
    const classes: string[] = [];
    if (isColumnLeader(player, columnIndex)) {
        classes.push('text-primary', 'font-bold');
    }
    if (columnIndex === plusMinusIndex.value && stat && stat !== '-') {
        const val = parseInt(stat);
        if (val > 0) classes.push('text-green-500');
        else if (val < 0) classes.push('text-red-500');
    }
    return classes.join(' ');
};

const sortBy = (column: number | 'name') => {
    if (sortColumn.value === column) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn.value = column;
        sortDirection.value = 'desc';
    }
};
</script>
