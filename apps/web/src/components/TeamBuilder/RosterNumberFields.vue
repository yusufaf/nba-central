<script setup lang="ts">
// A jersey number per rostered player. A plain <input> rather than the Input
// wrapper: its v-model would write the raw keystroke back over the cleaned
// value whenever the cleaned value doesn't change ("23a" over "23").
import { useId } from 'vue';
import { cleanNumber, withNumber, type RosterNumbers, type RosterRow } from '@/utils/rosterNumbers';

defineProps<{ roster: RosterRow[] }>();
const numbers = defineModel<RosterNumbers>('numbers', { default: () => ({}) });

const idPrefix = useId();

const onNumberInput = (slot: number, event: Event) => {
    const field = event.target as HTMLInputElement;
    // Whatever is in the field is what gets saved. Written back only when
    // cleaning changed it, so the caret stays put otherwise.
    const value = cleanNumber(field.value);
    if (field.value !== value) field.value = value;
    const next = withNumber(numbers.value, slot, value || null);
    if (next !== numbers.value) numbers.value = next;
};
</script>

<template>
    <p v-if="!roster.length" class="text-sm text-muted-foreground">Add players to give them numbers.</p>
    <template v-else>
        <p :id="`${idPrefix}-hint`" data-testid="number-hint" class="text-sm text-muted-foreground">0 to 99, or 00. Leave blank for none.</p>
        <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="row in roster" :key="row.slot" class="flex items-center gap-3">
                <input
                    :id="`${idPrefix}-${row.slot}`"
                    :data-slot="row.slot"
                    :value="numbers[row.slot] ?? ''"
                    :aria-describedby="`${idPrefix}-hint`"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="#"
                    class="h-10 w-16 shrink-0 rounded-md border border-input bg-background px-3 py-2 text-center text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    @input="onNumberInput(row.slot, $event)"
                />
                <label :for="`${idPrefix}-${row.slot}`" class="min-w-0 truncate text-sm text-foreground">{{ row.label }} · {{ row.name }}</label>
            </li>
        </ul>
    </template>
</template>
