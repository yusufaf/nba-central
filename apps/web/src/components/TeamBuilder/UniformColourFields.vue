<script setup lang="ts">
// The 3D uniform's colours. Until the owner picks one they're read off the
// team's jersey, as the scene does; picking any colour stores all three as
// an override, and "Use jersey colours" goes back to sampling.
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import type { TeamUniform } from '@/models/api';
import { HOME_KIT, loadJerseyColours } from '@/utils/jerseyColours';
import { normaliseHex } from '@/utils/court';

const props = defineProps<{ jerseyUrl?: string }>();
const uniform = defineModel<TeamUniform | null>('uniform', { default: null });

// The last jersey's colours stay up while a newer one is read (a drawn jersey
// changes on every stroke), and a slower earlier read never lands over it.
const sampled = ref<TeamUniform | null>(null);
let request = 0;
watch(
    () => props.jerseyUrl,
    async (url) => {
        const token = ++request;
        const colours = await loadJerseyColours(url || undefined);
        if (token === request) sampled.value = colours;
    },
    { immediate: true },
);

const effective = computed(() => uniform.value ?? sampled.value ?? HOME_KIT);
// Seeding an override from the placeholder kit would store colours the
// jersey doesn't have.
const waiting = computed(() => !uniform.value && !sampled.value);

const FIELDS = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'trim', label: 'Trim' },
] as const;

const set = (key: keyof TeamUniform, value: string) => {
    const hex = normaliseHex(value);
    if (!hex || hex === effective.value[key]) return;
    uniform.value = { ...effective.value, [key]: hex };
};
</script>

<template>
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div v-for="field in FIELDS" :key="field.key" class="flex items-center gap-2">
            <ColorPicker
                :model-value="effective[field.key]"
                :label="`${field.label} colour`"
                :disabled="waiting"
                @update:model-value="(value: string) => set(field.key, value)"
            />
            <span class="text-sm text-foreground">{{ field.label }}</span>
        </div>
        <Button variant="outline" size="sm" :disabled="!uniform" @click="uniform = null">Use jersey colours</Button>
    </div>
</template>
