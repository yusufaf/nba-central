<template>
    <Card>
        <CardHeader>
            <div class="flex items-center justify-between">
                <h3 class="text-1.125rem font-bold">Play-by-Play</h3>

                <!-- Filter Toggle Group -->
                <ToggleGroup v-model="selectedFilter" type="single" class="hidden md:flex">
                    <ToggleGroupItem value="all" aria-label="All plays">
                        All
                    </ToggleGroupItem>
                    <ToggleGroupItem value="shot" aria-label="Shots only">
                        Shots
                    </ToggleGroupItem>
                    <ToggleGroupItem value="foul" aria-label="Fouls only">
                        Fouls
                    </ToggleGroupItem>
                    <ToggleGroupItem value="turnover" aria-label="Turnovers only">
                        Turnovers
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </CardHeader>
        <CardContent class="p-0">
            <!-- Quarter Navigation -->
            <div class="flex gap-0.5rem p-1rem border-b overflow-x-auto">
                <Button
                    v-for="period in periods"
                    :key="period"
                    @click="scrollToPeriod(period)"
                    variant="outline"
                    size="sm"
                >
                    {{ getPeriodLabel(period) }}
                </Button>
            </div>

            <!-- Plays List -->
            <ScrollArea class="h-[37.5rem]">
                <Accordion type="multiple" class="w-full" :default-value="defaultOpenPeriods">
                    <AccordionItem
                        v-for="period in periods"
                        :key="period"
                        :value="`period-${period}`"
                        :ref="el => periodRefs[period] = el"
                    >
                        <AccordionTrigger class="px-1rem py-0.75rem hover:bg-muted/50">
                            <div class="flex items-center justify-between w-full pr-0.5rem">
                                <span class="font-semibold">{{ getPeriodLabel(period) }}</span>
                                <span class="text-0.875rem text-muted-foreground">
                                    {{ getFilteredPlaysForPeriod(period).length }} plays
                                </span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div class="divide-y">
                                <div
                                    v-for="play in getFilteredPlaysForPeriod(period)"
                                    :key="play.id"
                                    class="px-1rem py-0.75rem hover:bg-muted/30 transition-colors"
                                    :class="{
                                        'bg-primary/5': play.scoringPlay,
                                        'border-l-0.25rem border-l-primary': play.scoringPlay,
                                    }"
                                >
                                    <div class="flex items-start gap-1rem">
                                        <!-- Time -->
                                        <div class="text-0.75rem font-mono text-muted-foreground min-w-[3.125rem]">
                                            {{ play.clock.displayValue }}
                                        </div>

                                        <!-- Play Text -->
                                        <div class="flex-1">
                                            <p class="text-0.875rem" :class="{ 'font-semibold': play.scoringPlay }">
                                                {{ play.text }}
                                            </p>
                                            <p v-if="play.scoringPlay" class="text-0.75rem text-muted-foreground mt-0.25rem">
                                                Scoring play
                                            </p>
                                        </div>

                                        <!-- Score -->
                                        <div v-if="play.awayScore !== undefined && play.homeScore !== undefined" class="text-0.875rem font-semibold min-w-[3.75rem] text-right">
                                            {{ play.awayScore }} - {{ play.homeScore }}
                                        </div>
                                    </div>
                                </div>

                                <div v-if="getFilteredPlaysForPeriod(period).length === 0" class="px-1rem py-2rem text-center text-muted-foreground">
                                    No {{ selectedFilter === 'all' ? '' : selectedFilter }} plays in this period
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </ScrollArea>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ESPNPlay, ESPNCompetitor } from '@/models/types';

interface Props {
    plays: ESPNPlay[];
    competitors: ESPNCompetitor[];
}

const props = defineProps<Props>();

const selectedFilter = ref<string>('all');
const periodRefs = ref<Record<number, any>>({});

const periods = computed(() => {
    const periodSet = new Set(props.plays.map(p => p.period.number));
    return Array.from(periodSet).sort((a, b) => a - b);
});

const defaultOpenPeriods = computed(() => {
    // Open most recent period by default
    const latestPeriod = Math.max(...periods.value);
    return [`period-${latestPeriod}`];
});

const filteredPlays = computed(() => {
    if (selectedFilter.value === 'all') return props.plays;

    return props.plays.filter(play => {
        const typeText = play.type.text.toLowerCase();

        if (selectedFilter.value === 'shot') {
            return typeText.includes('made') || typeText.includes('miss') || typeText.includes('dunk') || typeText.includes('layup');
        } else if (selectedFilter.value === 'foul') {
            return typeText.includes('foul');
        } else if (selectedFilter.value === 'turnover') {
            return typeText.includes('turnover');
        }

        return false;
    });
});

const getFilteredPlaysForPeriod = (period: number) => {
    return filteredPlays.value
        .filter(p => p.period.number === period)
        .sort((a, b) => parseInt(b.sequenceNumber) - parseInt(a.sequenceNumber));
};

const getPeriodLabel = (period: number): string => {
    if (period <= 4) return `Q${period}`;
    if (period === 5) return 'OT';
    return `OT${period - 4}`;
};

const scrollToPeriod = (period: number) => {
    const ref = periodRefs.value[period];
    if (ref?.$el) {
        ref.$el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};
</script>
