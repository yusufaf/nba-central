<script setup lang="ts">
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ColourField from './creator/ColourField.vue';
import { RIBBON_TEXT_MAX, SCOREBOARD_TEXT_MAX, type VenueDesign } from '@/constants/venue';
import { LED_SWATCHES, newRibbon, newScoreboard, setVenuePart } from '@/utils/venue';

// The Scoreboard tab's settings (#296): the centre-hung scoreboard and the
// LED ribbon, each its own opt-in. Every change replaces the venue, so the
// arena being edited is never changed in place.
const props = defineProps<{ arenaName: string; disabled?: boolean }>();
const venue = defineModel<VenueDesign | null>('venue', { required: true });

type Part = 'scoreboard' | 'ribbon';

const setPart = <K extends Part>(key: K, value: VenueDesign[K] | undefined) => {
    venue.value = setVenuePart(venue.value, key, value);
};

const toggleScoreboard = (on: boolean) => setPart('scoreboard', on ? newScoreboard(props.arenaName) : undefined);
const toggleRibbon = (on: boolean) => setPart('ribbon', on ? newRibbon(props.arenaName) : undefined);

const setScoreboard = (change: Partial<NonNullable<VenueDesign['scoreboard']>>) => {
    if (venue.value?.scoreboard) setPart('scoreboard', { ...venue.value.scoreboard, ...change });
};
const setRibbon = (change: Partial<NonNullable<VenueDesign['ribbon']>>) => {
    if (venue.value?.ribbon) setPart('ribbon', { ...venue.value.ribbon, ...change });
};
</script>

<template>
    <div class="grid gap-6">
        <div class="grid gap-4">
            <div class="flex items-center gap-3">
                <Checkbox
                    id="venue-scoreboard"
                    :checked="!!venue?.scoreboard"
                    :disabled="disabled"
                    @update:checked="toggleScoreboard"
                />
                <Label for="venue-scoreboard">Scoreboard</Label>
            </div>
            <template v-if="venue?.scoreboard">
                <div class="grid gap-2">
                    <Label for="scoreboard-text">Scoreboard text</Label>
                    <Input
                        id="scoreboard-text"
                        :model-value="venue.scoreboard.text"
                        :maxlength="SCOREBOARD_TEXT_MAX"
                        :disabled="disabled"
                        aria-describedby="scoreboard-text-hint"
                        class="h-11"
                        @update:model-value="(text) => setScoreboard({ text: String(text) })"
                    />
                    <p id="scoreboard-text-hint" class="text-xs text-muted-foreground">
                        Up to {{ SCOREBOARD_TEXT_MAX }} characters, on all four screens.
                    </p>
                </div>
                <ColourField
                    :model-value="venue.scoreboard.accent"
                    label="Accent colour"
                    :swatches="LED_SWATCHES"
                    :disabled="disabled"
                    @update:model-value="(accent) => setScoreboard({ accent })"
                />
            </template>
        </div>

        <div class="grid gap-4">
            <div class="flex items-center gap-3">
                <Checkbox
                    id="venue-ribbon"
                    :checked="!!venue?.ribbon"
                    :disabled="disabled"
                    @update:checked="toggleRibbon"
                />
                <Label for="venue-ribbon">LED ribbon</Label>
            </div>
            <template v-if="venue?.ribbon">
                <div class="grid gap-2">
                    <Label for="ribbon-text">Ribbon text</Label>
                    <Input
                        id="ribbon-text"
                        :model-value="venue.ribbon.text"
                        :maxlength="RIBBON_TEXT_MAX"
                        :disabled="disabled"
                        aria-describedby="ribbon-text-hint"
                        class="h-11"
                        @update:model-value="(text) => setRibbon({ text: String(text) })"
                    />
                    <p id="ribbon-text-hint" class="text-xs text-muted-foreground">
                        Up to {{ RIBBON_TEXT_MAX }} characters. It scrolls around the bowl, except on touch screens or when Reduced motion is on.
                    </p>
                </div>
                <ColourField
                    :model-value="venue.ribbon.color"
                    label="Ribbon colour"
                    :swatches="LED_SWATCHES"
                    :disabled="disabled"
                    @update:model-value="(color) => setRibbon({ color })"
                />
            </template>
        </div>
    </div>
</template>
