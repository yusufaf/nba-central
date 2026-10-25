<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import PageTitle from "@/components/PageTitle.vue";
import PageShell from "@/layouts/PageShell.vue";
import StandingsTable from "@/components/Standings/StandingsTable.vue";
import { getSchedule, getStandings } from "@/network/liveData";
import { useDateFormat } from "@/composables/useDateFormat";
import { nextGames } from "@/utils/standings";
import type { ScheduleFile, StandingsFile } from "@/models/liveData";

const { formatDateTime } = useDateFormat();

const standings = shallowRef<StandingsFile | null>(null);
const schedule = shallowRef<ScheduleFile | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");

// Ticks so a game that tips off while the page is open leaves Next.
const now = ref(new Date());
let clock: ReturnType<typeof setInterval> | undefined;
let mounted = true;
onUnmounted(() => {
    mounted = false;
    clearInterval(clock);
});

// A missing schedule only blanks the Next column.
onMounted(async () => {
    const [standingsResult, scheduleResult] = await Promise.allSettled([getStandings(), getSchedule()]);
    if (scheduleResult.status === "fulfilled") schedule.value = scheduleResult.value;
    else console.error("Couldn't load the schedule", scheduleResult.reason);
    if (standingsResult.status === "fulfilled") {
        standings.value = standingsResult.value;
        state.value = "ready";
        // Only the Next column reads the clock.
        if (schedule.value && mounted) {
            now.value = new Date();
            clock = setInterval(() => {
                now.value = new Date();
            }, 60_000);
        }
    } else {
        console.error("Couldn't load the standings", standingsResult.reason);
        state.value = "error";
    }
});

const upcoming = computed(() => nextGames(schedule.value, now.value));
</script>

<template>
    <main class="pb-12">
        <PageTitle />
        <PageShell flush>
            <p v-if="state === 'loading'" class="text-center text-foreground/60" role="status">
                Loading standings...
            </p>
            <p v-else-if="state === 'error' || !standings" class="text-center text-foreground/60" role="status">
                Standings aren't available right now.
            </p>
            <template v-else>
                <p class="mb-4 text-center text-sm text-foreground/60">
                    {{ standings.season.displayName }} season. Updated {{ formatDateTime(standings.generatedAt) }}.
                    Unofficial; may lag behind live results.
                </p>
                <div class="@container">
                    <div class="grid gap-4 @min-[64rem]:grid-cols-2">
                        <StandingsTable
                            v-for="conference in standings.conferences"
                            :key="conference.name"
                            :conference="conference.name"
                            :teams="conference.teams"
                            :next-games="upcoming"
                        />
                    </div>
                </div>
            </template>
        </PageShell>
    </main>
</template>
