<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { seasonDecades, seasonLabel, type DailyEraGuess } from '@/utils/dailyEra';

const props = defineProps<{ guessed: DailyEraGuess[]; disabled?: boolean }>();
const season = defineModel<number | null>('season', { default: null });

const decades = seasonDecades();
const guessedSet = computed(() => new Set(props.guessed.map((g) => g.season)));

const decadeOf = (endYear: number) =>
    decades.find((d) => d.seasons.includes(endYear))?.label ?? '1980s';

// Opens on the decade of the latest guess, so a "later"/"earlier" arrow
// leads on from where the player just was.
const latestDecade = () => {
    const last = props.guessed.at(-1);
    return last ? decadeOf(last.season) : '1980s';
};
const decade = ref(latestDecade());
watch(
    () => props.guessed.length,
    () => {
        decade.value = latestDecade();
    },
);

// A single ToggleGroup emits '' when its pressed item is clicked again; a
// decade must stay picked.
const pickDecade = (value: unknown) => {
    if (typeof value === 'string' && value) decade.value = value;
};

const seasons = computed(() => decades.find((d) => d.label === decade.value)?.seasons ?? []);
</script>

<template>
    <div class="flex flex-col gap-3">
        <!-- The wrapper's flex row doesn't wrap; nine decades need a grid on a phone. -->
        <ToggleGroup
            :model-value="decade"
            type="single"
            size="sm"
            variant="outline"
            class="grid grid-cols-5 gap-1 md:grid-cols-9"
            aria-label="Decade"
            @update:model-value="pickDecade"
        >
            <ToggleGroupItem
                v-for="d in decades"
                :key="d.label"
                :value="d.label"
                class="px-1 tabular-nums"
            >
                {{ d.label }}
            </ToggleGroupItem>
        </ToggleGroup>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Button
                v-for="y in seasons"
                :key="y"
                :variant="season === y ? 'default' : 'outline'"
                size="sm"
                class="tabular-nums"
                :aria-pressed="season === y"
                :disabled="disabled || guessedSet.has(y)"
                @click="season = y"
            >
                {{ seasonLabel(y) }}
            </Button>
        </div>
    </div>
</template>
