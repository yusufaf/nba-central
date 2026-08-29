<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
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
import type { HistoricalLogo } from '@/models/types';
import historicalLogosData from '@/assets/data/historicalLogos.json';

const logos = historicalLogosData as HistoricalLogo[];

const teamLogo = defineModel<string>('teamLogo');

const search = ref<string>('');
const selectedDecade = ref<string>('All');
const selectedLeague = ref<string>('All');
const expanded = ref<boolean>(false);
const searchField = ref<HTMLElement | null>(null);

const DECADES = [
    'All',
    ...Array.from(
        new Set(logos.map((logo) => `${Math.floor(logo.startYear / 10) * 10}s`)),
    ).sort(),
];

// BAA and ABA logos sit alongside the NBA's in the same list, and picking one
// era of, say, the Nets means knowing which league it was played in.
const LEAGUES = ['All', ...Array.from(new Set(logos.map((logo) => logo.league))).sort()];

const filteredLogos = computed(() => {
    let result = logos;

    if (selectedDecade.value !== 'All') {
        const decadeStart = parseInt(selectedDecade.value, 10);
        result = result.filter(
            (logo) =>
                logo.startYear >= decadeStart && logo.startYear < decadeStart + 10,
        );
    }

    if (selectedLeague.value !== 'All') {
        result = result.filter((logo) => logo.league === selectedLeague.value);
    }

    if (search.value.trim()) {
        const searchLower = search.value.toLowerCase().trim();
        result = result.filter(
            (logo) =>
                logo.name.toLowerCase().includes(searchLower) ||
                logo.franchiseName.toLowerCase().includes(searchLower) ||
                logo.years.includes(searchLower),
        );
    }

    return result;
});

const handleLogoClick = (logo: HistoricalLogo) => {
    teamLogo.value = logo.logo;
};

const collapse = () => {
    expanded.value = false;
};

/**
 * The picker expands over the Team Customization dialog it lives in, so Escape
 * has to collapse the overlay without also dismissing that dialog. Listening on
 * window in the capture phase gets us ahead of reka-ui's document-level
 * dismiss handler.
 */
const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    collapse();
};

watch(expanded, (isExpanded) => {
    if (isExpanded) {
        window.addEventListener('keydown', handleEscape, true);
        nextTick(() => searchField.value?.querySelector('input')?.focus());
    } else {
        window.removeEventListener('keydown', handleEscape, true);
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleEscape, true);
});
</script>

<template>
    <!-- Teleport rather than a second markup block: the same nodes move, so the
         234 tiles are never duplicated and the search and filters keep their
         values across expand/collapse. Only while expanded, so the picker can
         overlay the page rather than being clipped by the dialog. -->
    <Teleport to="body" :disabled="!expanded">
        <div class="historical-logo-picker" :class="{ expanded }">
            <div v-if="expanded" class="picker-header">
                <span class="picker-title">All-time team logos</span>
                <button
                    type="button"
                    class="picker-icon-button"
                    aria-label="Collapse logo browser"
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
                    aria-label="Expand logo browser"
                    title="Expand"
                    @click="expanded = true"
                >
                    <Maximize2 class="h-4 w-4" />
                </button>
            </div>

            <p class="picker-count">
                {{ filteredLogos.length }}
                {{ filteredLogos.length === 1 ? 'logo' : 'logos' }}
                <template v-if="filteredLogos.length !== logos.length">
                    of {{ logos.length }}
                </template>
            </p>

            <ScrollArea class="picker-results">
                <div v-if="filteredLogos.length === 0" class="empty-state">
                    No logos match that search.
                </div>
                <div v-else class="team-logos">
                    <button
                        v-for="logo in filteredLogos"
                        :key="`${logo.team}-${logo.startYear}`"
                        type="button"
                        class="team-logo-tile"
                        :class="{ selected: logo.logo === teamLogo }"
                        :aria-pressed="logo.logo === teamLogo"
                        @click="handleLogoClick(logo)"
                    >
                        <span class="team-logo-plate">
                            <img
                                :src="logo.logo"
                                :alt="`${logo.name} logo`"
                                class="team-logo"
                                width="125"
                                height="125"
                                loading="lazy"
                            />
                            <span v-if="logo.logo === teamLogo" class="team-logo-check">
                                <Check class="h-3 w-3" />
                            </span>
                        </span>
                        <span class="team-logo-caption">
                            <span class="team-logo-name">{{ logo.name }}</span>
                            <span class="team-logo-years">{{ logo.years }}</span>
                        </span>
                    </button>
                </div>
            </ScrollArea>
        </div>
    </Teleport>
</template>

<style scoped>
.historical-logo-picker {
    --tile-min: 8.5rem;
    --results-height: 26rem;

    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.historical-logo-picker.expanded {
    --tile-min: 9.5rem;
    --results-height: calc(100vh - 12.5rem);

    position: fixed;
    inset: 0;
    z-index: 60;
    padding: 1.5rem 2rem 2rem;
    gap: 0.875rem;
    background: hsl(0 0% 7% / 0.98);
    backdrop-filter: blur(0.75rem);
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
    /* A definite height, not max-height: ScrollArea's viewport is h-full, and a
       percentage height against an indefinite parent resolves to auto - the
       viewport then grows past the pane and the overflow is clipped away
       instead of scrolled. */
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

.empty-state {
    padding: 3rem 0;
    text-align: center;
    color: hsl(var(--muted-foreground));
    font-size: 0.875rem;
}

.team-logos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
    gap: 0.75rem;
}

.team-logo-tile {
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

.team-logo-tile:hover {
    border-color: hsl(var(--primary) / 0.6);
    background: hsl(var(--primary) / 0.06);
}

.team-logo-tile:focus-visible {
    outline: none;
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 0.1875rem hsl(var(--primary) / 0.35);
}

.team-logo-tile.selected {
    border-color: hsl(var(--primary));
    background: hsl(var(--primary) / 0.12);
    box-shadow: 0 0 0 0.125rem hsl(var(--primary) / 0.3);
}

.team-logo-plate {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 0.625rem;
    /* The artwork is transparent now, but a lot of these logos are mostly white
       or silver; a faint plate keeps them legible on the dark theme. */
    background: hsl(0 0% 100% / 0.08);
}

.team-logo {
    width: 82%;
    height: 82%;
    object-fit: contain;
}

.team-logo-check {
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

.team-logo-caption {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    text-align: center;
    line-height: 1.25;
}

.team-logo-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.team-logo-years {
    font-size: 0.75rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
}
</style>
