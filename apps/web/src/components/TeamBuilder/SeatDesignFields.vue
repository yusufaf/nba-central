<script setup lang="ts">
import { computed } from 'vue';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import ColourField from './creator/ColourField.vue';
import { SEAT_PATTERNS, type SeatPatternId, type VenueDesign } from '@/constants/venue';
import { formatCapacity } from '@/utils/arenaDetails';
import {
    DEFAULT_CAPACITY,
    SEAT_PATTERN_LABELS,
    SEAT_SWATCHES,
    SECONDARY_HINTS,
    patternChip,
} from '@/utils/venue';

// The Seats tab's settings (#295). Every change replaces the venue, so the
// arena being edited is never changed in place.
const props = defineProps<{ capacity: number | null; disabled?: boolean }>();
const venue = defineModel<VenueDesign>('venue', { required: true });

const setSeat = <K extends keyof VenueDesign['seats']>(key: K, value: VenueDesign['seats'][K]) => {
    venue.value = { ...venue.value, seats: { ...venue.value.seats, [key]: value } };
};
const setUpperDeck = (value: boolean) => {
    venue.value = { ...venue.value, upperDeck: value };
};
// A clear (clicking the selected toggle again) is ignored: a pattern is required.
const choosePattern = (pattern: unknown) => {
    if (pattern) setSeat('pattern', pattern as SeatPatternId);
};

const depthHint = computed(() =>
    props.capacity === null
        ? `The bowl's depth follows the capacity on Details (none set, so it's sized for ${formatCapacity(DEFAULT_CAPACITY)} seats).`
        : `The bowl's depth follows the capacity on Details: ${formatCapacity(props.capacity)} seats.`,
);
</script>

<template>
    <div class="grid gap-5">
        <div class="grid gap-2">
            <Label id="seat-pattern-label">Pattern</Label>
            <ToggleGroup
                type="single"
                variant="outline"
                class="grid grid-cols-2 gap-2 @min-[28rem]:grid-cols-4"
                aria-labelledby="seat-pattern-label"
                :model-value="venue.seats.pattern"
                :disabled="disabled"
                @update:model-value="choosePattern"
            >
                <ToggleGroupItem
                    v-for="pattern in SEAT_PATTERNS"
                    :key="pattern"
                    :value="pattern"
                    class="h-auto flex-col gap-1.5 py-2"
                >
                    <span
                        class="h-6 w-full rounded-sm border border-border"
                        :style="patternChip(pattern, venue.seats)"
                        aria-hidden="true"
                    />
                    {{ SEAT_PATTERN_LABELS[pattern] }}
                </ToggleGroupItem>
            </ToggleGroup>
        </div>

        <ColourField
            :model-value="venue.seats.primary"
            label="Primary colour"
            :swatches="SEAT_SWATCHES"
            :disabled="disabled"
            @update:model-value="(colour) => setSeat('primary', colour)"
        />
        <div class="grid gap-2">
            <ColourField
                :model-value="venue.seats.secondary"
                label="Secondary colour"
                :swatches="SEAT_SWATCHES"
                :disabled="disabled"
                @update:model-value="(colour) => setSeat('secondary', colour)"
            />
            <p class="text-xs text-muted-foreground">{{ SECONDARY_HINTS[venue.seats.pattern] }}</p>
        </div>

        <div class="grid gap-1">
            <div class="flex items-center gap-3">
                <Checkbox
                    id="seat-upper-deck"
                    :checked="venue.upperDeck"
                    :disabled="disabled"
                    aria-describedby="seat-upper-deck-hint"
                    @update:checked="setUpperDeck"
                />
                <Label for="seat-upper-deck">Upper deck</Label>
            </div>
            <p id="seat-upper-deck-hint" class="text-xs text-muted-foreground">
                A second tier above the lower bowl. {{ depthHint }}
            </p>
        </div>
    </div>
</template>
