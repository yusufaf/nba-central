<script setup lang="ts">
import { ref } from 'vue';
import { Check, ChevronsUpDown } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import historicalTeams from '@/assets/data/nbaHistoricalTeams.json';

interface HistoricalTeam {
    name: string;
    city: string;
    country: string;
}

const teams = historicalTeams as HistoricalTeam[];

const emit = defineEmits<{
    select: [team: HistoricalTeam];
}>();

const open = ref(false);
const selectedName = ref('');

const handleSelect = (name: string) => {
    const team = teams.find((t) => t.name === name);
    if (!team) return;

    selectedName.value = name;
    open.value = false;
    emit('select', team);
};
</script>

<template>
    <Popover v-model:open="open">
        <PopoverTrigger as-child>
            <Button
                variant="outline"
                role="combobox"
                :aria-expanded="open"
                class="combobox-trigger"
            >
                <span :class="{ 'text-muted-foreground': !selectedName }">
                    {{ selectedName || 'Select historical team...' }}
                </span>
                <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
            </Button>
        </PopoverTrigger>
        <PopoverContent class="combobox-content" align="start">
            <Command>
                <CommandInput placeholder="Search team names..." />
                <CommandList>
                    <CommandEmpty>No team found.</CommandEmpty>
                    <CommandGroup>
                        <CommandItem
                            v-for="team in teams"
                            :key="team.name"
                            :value="team.name"
                            @select="handleSelect(team.name)"
                        >
                            <Check
                                :class="cn('h-4 w-4', selectedName === team.name ? 'opacity-100' : 'opacity-0')"
                            />
                            {{ team.name }}
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
</template>

<style scoped>
.combobox-trigger {
    width: 100%;
    justify-content: space-between;
    font-weight: 400;
}

.combobox-content {
    width: var(--reka-popper-anchor-width, 24rem);
    padding: 0;
}
</style>
