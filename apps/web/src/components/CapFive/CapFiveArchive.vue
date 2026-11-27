<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Card } from '@/components/ui/card';
import { useDateFormat } from '@/composables/useDateFormat';
import { parseIsoDate } from '@/utils/date';
import {
    capFiveArchiveDays,
    capFiveDayStatus,
    capFivePuzzleNumber,
    type CapFiveDayStatus,
    type StoredCapFiveGame,
} from '@/utils/capFive';

const props = defineProps<{
    games: Record<string, StoredCapFiveGame>;
    today: string;
    /** The date being played, to mark its row. */
    current: string;
}>();

const { formatDate } = useDateFormat();

const TONE_CLASS = {
    success: 'text-success',
    destructive: 'text-destructive',
    muted: 'text-foreground/80',
    play: 'text-primary-strong',
} satisfies Record<CapFiveDayStatus['tone'], string>;

const rows = computed(() =>
    capFiveArchiveDays(props.today).map((day) => ({
        day,
        number: capFivePuzzleNumber(day),
        label: formatDate(parseIsoDate(day)!, 'medium'),
        status: capFiveDayStatus(props.games[day]),
    })),
);
</script>

<template>
    <Card v-if="rows.length" class="mx-auto flex w-full max-w-[40rem] flex-col gap-4 p-4 sm:p-8">
        <div class="flex flex-col gap-1">
            <h2 class="text-[1.125rem] font-semibold">Archive</h2>
            <p class="text-sm text-foreground/80">
                Earlier puzzles you can still play. A lineup locked in after its day doesn't count toward your streak.
            </p>
        </div>
        <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="row in rows" :key="row.day">
                <RouterLink
                    :to="{ name: 'capFive', query: { date: row.day } }"
                    :aria-current="row.day === current ? 'page' : undefined"
                    data-testid="archive-day"
                    class="flex min-h-10 items-center gap-3 rounded-md border px-3 py-2 hover:bg-foreground/5"
                    :class="row.day === current ? 'border-primary-strong' : 'border-border'"
                >
                    <span class="font-bold tabular-nums">#{{ row.number }}</span>
                    <span class="text-sm">{{ row.label }}</span>
                    <span class="ml-auto text-sm" :class="TONE_CLASS[row.status.tone]">{{ row.status.label }}</span>
                </RouterLink>
            </li>
        </ul>
    </Card>
</template>
