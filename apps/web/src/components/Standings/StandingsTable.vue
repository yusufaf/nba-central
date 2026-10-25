<script setup lang="ts">
import { reactive } from "vue";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SectionHeading from "@/components/layout/SectionHeading.vue";
import currentTeamLogos from "@/assets/data/currentTeamLogos.json";
import type { ConferenceName, StandingsTeam } from "@/models/liveData";
import { espnGameWeekday } from "@/utils/date";
import { formatGamesBehind, formatWinPercent, type NextGame } from "@/utils/standings";

const props = defineProps<{
    conference: ConferenceName;
    teams: StandingsTeam[];
    nextGames: Map<string, NextGame>;
}>();

const TITLES: Record<ConferenceName, string> = {
    East: "Eastern Conference",
    West: "Western Conference",
};

const logoByName = new Map(currentTeamLogos.map((team) => [team.name, team.logo]));

// The logos are ESPN hotlinks. One that fails to load is dropped rather than
// left as a broken-image glyph.
const failedLogos = reactive(new Set<string>());
const logoFor = (team: StandingsTeam) =>
    failedLogos.has(team.espnId) ? undefined : logoByName.get(team.name);

// 1-6 make the playoffs, 7-10 the play-in.
const endsGroup = (index: number) => index === 5 || index === 9;

const nextGameLabel = (team: StandingsTeam) => {
    const game = props.nextGames.get(team.espnId);
    if (!game) return "";
    const label = `${game.home ? "vs" : "@"} ${game.opponent}`;
    const day = espnGameWeekday(game.date);
    return day ? `${label} ${day}` : label;
};
</script>

<template>
    <Card class="@container" :data-conference="conference">
        <CardContent class="p-3">
            <SectionHeading class="mb-2">{{ TITLES[conference] }}</SectionHeading>
            <Table class="whitespace-nowrap tabular-nums">
                <TableHeader>
                    <TableRow class="text-xs uppercase text-foreground/60">
                        <TableHead class="h-9 px-2 w-8 text-right">#</TableHead>
                        <TableHead class="h-9 px-2">Team</TableHead>
                        <TableHead class="h-9 px-2 text-right">W</TableHead>
                        <TableHead class="h-9 px-2 text-right">L</TableHead>
                        <TableHead class="h-9 px-2 text-right">PCT</TableHead>
                        <TableHead class="h-9 px-2 text-right">GB</TableHead>
                        <TableHead class="h-9 px-2 hidden @min-[34rem]:table-cell text-right">L10</TableHead>
                        <TableHead class="h-9 px-2 hidden @min-[34rem]:table-cell text-right">STRK</TableHead>
                        <TableHead class="h-9 px-2 hidden @min-[34rem]:table-cell">Next</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow
                        v-for="(team, index) in teams"
                        :key="team.espnId"
                        data-testid="standings-row"
                        :class="{ 'group-end': endsGroup(index) }"
                    >
                        <TableCell class="px-2 py-2 text-right text-foreground/60">{{ index + 1 }}</TableCell>
                        <TableCell class="px-2 py-2">
                            <div class="flex items-center gap-2 font-semibold">
                                <img
                                    v-if="logoFor(team)"
                                    :src="logoFor(team)"
                                    alt=""
                                    class="object-contain shrink-0 w-6 h-6"
                                    @error="failedLogos.add(team.espnId)"
                                />
                                <span class="@min-[34rem]:hidden">{{ team.abbreviation }}</span>
                                <span class="hidden @min-[34rem]:inline">{{ team.name }}</span>
                            </div>
                        </TableCell>
                        <TableCell class="px-2 py-2 text-right">{{ team.wins }}</TableCell>
                        <TableCell class="px-2 py-2 text-right">{{ team.losses }}</TableCell>
                        <TableCell class="px-2 py-2 text-right">{{ formatWinPercent(team.winPercent) }}</TableCell>
                        <TableCell class="px-2 py-2 text-right">{{ formatGamesBehind(team.gamesBehind) }}</TableCell>
                        <TableCell class="px-2 py-2 hidden @min-[34rem]:table-cell text-right">{{ team.lastTen }}</TableCell>
                        <TableCell class="px-2 py-2 hidden @min-[34rem]:table-cell text-right">{{ team.streak }}</TableCell>
                        <TableCell class="px-2 py-2 hidden @min-[34rem]:table-cell text-foreground/80">
                            {{ nextGameLabel(team) }}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </CardContent>
    </Card>
</template>

<style scoped>
/* The playoff and play-in lines. */
.group-end {
    border-bottom: 0.125rem solid hsl(var(--border));
}
</style>
