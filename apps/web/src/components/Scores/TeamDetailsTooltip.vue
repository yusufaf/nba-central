<script setup lang="ts">
import { computed } from "vue";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { loadStandings, standingFor, standingsState } from "@/composables/useStandings";
import { teamDetailsLines, type TooltipLine } from "@/utils/standings";

const props = defineProps<{
    competitorId: string;
    homeAway: string;
}>();

// From live/standings.json on the assets CDN, which setSeasonContextData
// copies from ESPN hourly: the browser never calls ESPN for it (#218).
const standing = computed(() => standingFor(props.competitorId));
const lines = computed(() => (standing.value ? teamDetailsLines(standing.value, props.homeAway) : []));

const toneClass: Record<NonNullable<TooltipLine["tone"]>, string> = {
    positive: "font-semibold text-success",
    negative: "font-semibold text-destructive-strong",
};
</script>

<template>
    <TooltipProvider>
        <Tooltip @update:open="(open) => open && loadStandings()">
            <TooltipTrigger as-child>
                <slot />
            </TooltipTrigger>
            <TooltipContent side="right" align="center" :side-offset="10">
                <div class="text-xs">
                    <template v-if="lines.length">
                        <div v-for="line in lines" :key="line.text" :class="line.tone && toneClass[line.tone]">
                            {{ line.text }}
                        </div>
                    </template>
                    <!-- Load failed, or a team the file doesn't list (an All-Star side). -->
                    <div v-else-if="standingsState === 'ready' || standingsState === 'error'">Standings unavailable.</div>
                    <!-- Idle too, so the first render never flashes unavailable. -->
                    <div v-else>Loading...</div>
                </div>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>
