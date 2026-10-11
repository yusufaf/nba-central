<script setup lang="ts">
import { computed } from "vue";
import { CalendarX2, Eye, Filter } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import type { ScoresEmptyReason } from "@/utils/scoresEmptyState";

const props = defineProps<{
    reason: Exclude<ScoresEmptyReason, "none">;
    conferenceFilter: string;
    dateLabel: string;
}>();

const emit = defineEmits<{
    showFinished: [];
    showAllConferences: [];
}>();

const CONFERENCE_LABELS: Record<string, string> = {
    EAST: "Eastern Conference",
    WEST: "Western Conference",
    CROSS: "East vs. West",
};

const content = computed(() => {
    switch (props.reason) {
        case "no-games":
            return {
                icon: CalendarX2,
                title: "No games scheduled",
                copy: `There are no NBA games on ${props.dateLabel}.`,
                action: null,
            };
        case "conference":
            return {
                icon: Filter,
                title: `No ${CONFERENCE_LABELS[props.conferenceFilter] ?? "matching"} games`,
                copy: "None of this day's games match the conference filter.",
                action: { label: "Show all games", emit: () => emit("showAllConferences") },
            };
        default:
            return {
                icon: Eye,
                title: "All games are final",
                copy: "Hide Finished Games is on, so every result is hidden.",
                action: { label: "Show finished games", emit: () => emit("showFinished") },
            };
    }
});
</script>

<template>
    <div class="empty-state" role="status">
        <div class="empty-state-icon">
            <component :is="content.icon" class="h-10 w-10 text-primary-strong" />
        </div>
        <p class="empty-state-title">{{ content.title }}</p>
        <p class="empty-state-copy">{{ content.copy }}</p>
        <Button v-if="content.action" @click="content.action.emit">
            {{ content.action.label }}
        </Button>
    </div>
</template>

<style scoped>
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 4rem 1.5rem;
}

.empty-state-icon {
    background-color: hsl(var(--primary) / 0.1);
    border-radius: 9999px;
    padding: 1.25rem;
    margin-bottom: 1rem;
}

.empty-state-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.empty-state-copy {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    margin: 0.25rem 0 1.5rem;
    max-width: 24rem;
}
</style>
