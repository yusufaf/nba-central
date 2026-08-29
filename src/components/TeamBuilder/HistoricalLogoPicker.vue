<script setup lang="ts">
import { computed, ref } from 'vue';
import { Search } from 'lucide-vue-next';
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

const DECADES = [
    'All',
    ...Array.from(
        new Set(logos.map((logo) => `${Math.floor(logo.startYear / 10) * 10}s`)),
    ).sort(),
];

const filteredLogos = computed(() => {
    let result = logos;

    if (selectedDecade.value !== 'All') {
        const decadeStart = parseInt(selectedDecade.value, 10);
        result = result.filter(
            (logo) =>
                logo.startYear >= decadeStart && logo.startYear < decadeStart + 10,
        );
    }

    if (search.value.trim()) {
        const searchLower = search.value.toLowerCase().trim();
        result = result.filter(
            (logo) =>
                logo.name.toLowerCase().includes(searchLower) ||
                logo.years.includes(searchLower),
        );
    }

    return result;
});

const handleLogoClick = (logo: HistoricalLogo) => {
    teamLogo.value = logo.logo;
};
</script>

<template>
    <div class="historical-logo-picker">
        <div class="picker-controls">
            <div class="relative flex-1">
                <Input
                    v-model="search"
                    placeholder="Search team names..."
                    type="search"
                    class="pl-9"
                />
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
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
        </div>

        <ScrollArea class="picker-results">
            <div v-if="filteredLogos.length === 0" class="empty-state">
                No logos found.
            </div>
            <div v-else class="team-logos">
                <button
                    v-for="logo in filteredLogos"
                    :key="`${logo.team}-${logo.startYear}`"
                    type="button"
                    class="team-logo-tile"
                    :class="{ selected: logo.logo === teamLogo }"
                    @click="handleLogoClick(logo)"
                >
                    <img
                        :src="logo.logo"
                        :alt="`${logo.name} logo`"
                        class="team-logo"
                        width="100"
                        height="100"
                        loading="lazy"
                    />
                    <span class="team-logo-caption">
                        <span class="team-logo-name">{{ logo.name }}</span>
                        <span class="team-logo-years">{{ logo.years }}</span>
                    </span>
                </button>
            </div>
        </ScrollArea>
    </div>
</template>

<style scoped>
.historical-logo-picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.picker-controls {
    display: flex;
    gap: 0.5rem;
}

.decade-select {
    width: 8.5rem;
    flex-shrink: 0;
}

.picker-results {
    max-height: 24rem;
    border: 0.0625rem solid hsl(var(--border));
    border-radius: 0.5rem;
    padding: 0.75rem;
}

.empty-state {
    padding: 2rem 0;
    text-align: center;
    color: hsl(var(--muted-foreground));
    font-size: 0.875rem;
}

.team-logos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.25rem, 1fr));
    gap: 0.75rem;
}

.team-logo-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem;
    border: 0.125rem solid hsl(var(--border));
    border-radius: 0.5rem;
    cursor: pointer;
    background: transparent;
    transition: border-color 0.2s;
}

.team-logo-tile:hover {
    border-color: hsl(var(--primary));
}

.team-logo-tile.selected {
    border: 0.25rem solid hsl(var(--primary));
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
}

.team-logo {
    height: 5rem;
    width: 5rem;
    object-fit: contain;
}

.team-logo-caption {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    line-height: 1.2;
}

.team-logo-name {
    font-size: 0.6875rem;
    font-weight: 500;
    color: hsl(var(--foreground));
}

.team-logo-years {
    font-size: 0.625rem;
    color: hsl(var(--muted-foreground));
}
</style>
