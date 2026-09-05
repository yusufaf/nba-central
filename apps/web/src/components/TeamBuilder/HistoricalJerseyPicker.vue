<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Maximize2, Search, X } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { HistoricalJersey } from '@/models/types';
import historicalJerseysData from '@/assets/data/historicalJerseys.json';
import { useExpandablePicker } from '@/composables/useExpandablePicker';

const jerseys = historicalJerseysData as HistoricalJersey[];

const teamJersey = defineModel<string>('teamJersey');
// Modeled so the Team Customization dialog can tell the fullscreen overlay
// apart from its own click-outside handling - see HistoricalLogoPicker for
// why that matters.
const expanded = defineModel<boolean>('expanded', { default: false });

const search = ref<string>('');
const selectedDecade = ref<string>('All');
const selectedLeague = ref<string>('All');
const searchField = ref<HTMLElement | null>(null);
const pickerRoot = ref<HTMLElement | null>(null);

const { collapse } = useExpandablePicker(expanded, pickerRoot, searchField);

const DECADES = [
    'All',
    ...Array.from(
        new Set(jerseys.map((jersey) => `${Math.floor(jersey.startYear / 10) * 10}s`)),
    ).sort(),
];

const LEAGUES = ['All', ...Array.from(new Set(jerseys.map((jersey) => jersey.league))).sort()];

const filteredJerseys = computed(() => {
    let result = jerseys;

    if (selectedDecade.value !== 'All') {
        const decadeStart = parseInt(selectedDecade.value, 10);
        result = result.filter(
            (jersey) =>
                jersey.startYear >= decadeStart && jersey.startYear < decadeStart + 10,
        );
    }

    if (selectedLeague.value !== 'All') {
        result = result.filter((jersey) => jersey.league === selectedLeague.value);
    }

    if (search.value.trim()) {
        const searchLower = search.value.toLowerCase().trim();
        result = result.filter(
            (jersey) =>
                jersey.name.toLowerCase().includes(searchLower) ||
                jersey.franchiseName.toLowerCase().includes(searchLower) ||
                jersey.years.includes(searchLower),
        );
    }

    return result;
});

const handleJerseyClick = (jersey: HistoricalJersey) => {
    teamJersey.value = jersey.jersey;
};
</script>

<template>
    <!-- Teleport rather than a second markup block - see HistoricalLogoPicker
         for why. -->
    <Teleport to="body" :disabled="!expanded">
        <div ref="pickerRoot" class="historical-jersey-picker" :class="{ expanded }">
            <div v-if="expanded" class="picker-header">
                <span class="picker-title">All-time team jerseys</span>
                <button
                    type="button"
                    class="picker-icon-button"
                    aria-label="Collapse jersey browser"
                    @click="collapse"
                >
                    <X class="h-4 w-4" />
                </button>
            </div>

            <div class="picker-controls">
                <div ref="searchField" class="relative flex-1">
                    <Input
                        v-model="search"
                        placeholder="Search team or franchise..."
                        type="search"
                        class="pl-9"
                    />
                    <Search
                        class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    />
                </div>
                <Select v-model="selectedLeague">
                    <SelectTrigger class="league-select">
                        <SelectValue placeholder="League" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="league in LEAGUES" :key="league" :value="league">
                            {{ league === 'All' ? 'All leagues' : league }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <Select v-model="selectedDecade">
                    <SelectTrigger class="decade-select">
                        <SelectValue placeholder="Decade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="decade in DECADES" :key="decade" :value="decade">
                            {{ decade === 'All' ? 'All decades' : decade }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <button
                    v-if="!expanded"
                    type="button"
                    class="picker-icon-button"
                    aria-label="Expand jersey browser"
                    title="Expand"
                    @click="expanded = true"
                >
                    <Maximize2 class="h-4 w-4" />
                </button>
            </div>

            <p class="picker-count">
                {{ filteredJerseys.length }}
                {{ filteredJerseys.length === 1 ? 'jersey' : 'jerseys' }}
                <template v-if="filteredJerseys.length !== jerseys.length">
                    of {{ jerseys.length }}
                </template>
            </p>

            <ScrollArea class="picker-results">
                <div v-if="filteredJerseys.length === 0" class="empty-state">
                    No jerseys match that search.
                </div>
                <div v-else class="team-jerseys">
                    <button
                        v-for="jersey in filteredJerseys"
                        :key="jersey.jersey"
                        type="button"
                        class="team-jersey-tile"
                        :class="{ selected: jersey.jersey === teamJersey }"
                        :aria-pressed="jersey.jersey === teamJersey"
                        @click="handleJerseyClick(jersey)"
                    >
                        <span class="team-jersey-plate">
                            <img
                                :src="jersey.jersey"
                                :alt="jersey.name"
                                class="team-jersey-image"
                                width="400"
                                height="400"
                                loading="lazy"
                            />
                            <span v-if="jersey.jersey === teamJersey" class="team-jersey-check">
                                <Check class="h-3 w-3" />
                            </span>
                            <span v-if="jersey.slot === 'alternate'" class="team-jersey-badge">
                                Alternate
                            </span>
                        </span>
                        <span class="team-jersey-caption">
                            <span class="team-jersey-name">{{ jersey.franchiseName }}</span>
                            <span class="team-jersey-years">{{ jersey.years }}</span>
                        </span>
                    </button>
                </div>
            </ScrollArea>

            <p class="picker-attribution">
                Jersey artwork from the
                <a href="https://www.bballjerseys.com" target="_blank" rel="noopener noreferrer">
                    Basketball Jersey Database
                </a>.
            </p>
        </div>
    </Teleport>
</template>

<style scoped>
.historical-jersey-picker {
    --tile-min: 8.5rem;
    --results-height: 26rem;

    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.historical-jersey-picker.expanded {
    --tile-min: 9.5rem;
    --results-height: calc(100vh - 14.5rem);

    position: fixed;
    inset: 0;
    z-index: 60;
    padding: 1.5rem 2rem 2rem;
    gap: 0.875rem;
    background: hsl(0 0% 7% / 0.98);
    backdrop-filter: blur(0.75rem);
    /* See HistoricalLogoPicker: a modal Dialog sets body { pointer-events:
       none } and only re-enables it on layers it knows about - this overlay
       isn't one, since it teleported past the dialog's own DOM subtree. */
    pointer-events: auto;
}

.picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.picker-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: hsl(var(--foreground));
}

.picker-controls {
    display: flex;
    gap: 0.5rem;
}

.league-select {
    width: 7rem;
    flex-shrink: 0;
}

.decade-select {
    width: 8.5rem;
    flex-shrink: 0;
}

.picker-icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    flex-shrink: 0;
    border: 0.0625rem solid hsl(var(--border));
    border-radius: var(--radius);
    color: hsl(var(--muted-foreground));
    background: transparent;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
}

.picker-icon-button:hover {
    color: hsl(var(--primary));
    border-color: hsl(var(--primary));
}

.picker-count {
    margin: 0;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
}

.picker-results {
    /* See HistoricalLogoPicker for why this is a definite height rather than
       a max-height. */
    height: var(--results-height);
    border: 0.0625rem solid hsl(var(--border));
    border-radius: var(--radius);
    padding: 0.75rem;
    background: hsl(var(--card));
}

.expanded .picker-results {
    flex: 1;
    min-height: 0;
}

.picker-attribution {
    margin: 0;
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
}

.picker-attribution a {
    color: hsl(var(--primary));
    text-decoration: underline;
    text-underline-offset: 0.125rem;
}

.empty-state {
    padding: 3rem 0;
    text-align: center;
    color: hsl(var(--muted-foreground));
    font-size: 0.875rem;
}

.team-jerseys {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
    gap: 0.75rem;
}

.team-jersey-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 0.125rem solid hsl(var(--border));
    border-radius: 0.75rem;
    cursor: pointer;
    background: transparent;
    /* Border width stays put across every state - only its colour and the ring
       change - so selecting a tile never reflows the grid. */
    transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
}

.team-jersey-tile:hover {
    border-color: hsl(var(--primary) / 0.6);
    background: hsl(var(--primary) / 0.06);
}

.team-jersey-tile:focus-visible {
    outline: none;
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 0.1875rem hsl(var(--primary) / 0.35);
}

.team-jersey-tile.selected {
    border-color: hsl(var(--primary));
    background: hsl(var(--primary) / 0.12);
    box-shadow: 0 0 0 0.125rem hsl(var(--primary) / 0.3);
}

.team-jersey-plate {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 0.625rem;
    overflow: hidden;
    /* Unlike the logos, this artwork is opaque - a full square illustration
       with its own coloured background - so no backing plate colour is
       needed underneath it. */
    background: hsl(0 0% 100% / 0.04);
}

.team-jersey-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.team-jersey-check {
    position: absolute;
    top: -0.375rem;
    right: -0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 9999px;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
}

.team-jersey-badge {
    position: absolute;
    bottom: 0.375rem;
    left: 0.375rem;
    padding: 0.0625rem 0.375rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 600;
    color: hsl(var(--primary-foreground));
    background: hsl(var(--primary) / 0.85);
}

.team-jersey-caption {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    text-align: center;
    line-height: 1.25;
}

.team-jersey-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.team-jersey-years {
    font-size: 0.75rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
}
</style>
