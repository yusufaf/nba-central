<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Check, ChevronsUpDown } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getCurrentTeamSeason, getTeamSeasonsIndex } from '@/network/teamSeasons';
import { franchiseChoices, realParam, seasonChoices, type FranchiseChoice } from '@/utils/realTeam';

const open = defineModel<boolean>('open', { default: false });

defineProps<{
    // The builder already holds players, so picking replaces them.
    hasRoster: boolean;
}>();

const emit = defineEmits<{
    // `?real=` value, e.g. "CHI-1996".
    pick: [param: string];
}>();

const franchises = ref<FranchiseChoice[]>([]);
const loading = ref(false);
const failed = ref(false);
const comboboxOpen = ref(false);
const franchiseCode = ref<string | null>(null);
const selected = ref<string | null>(null);

const load = async () => {
    loading.value = true;
    failed.value = false;
    try {
        const [index, current] = await Promise.all([getTeamSeasonsIndex(), getCurrentTeamSeason()]);
        franchises.value = franchiseChoices(seasonChoices(index, current));
    } catch (err) {
        console.error('Failed to load team-seasons', err);
        failed.value = true;
    } finally {
        loading.value = false;
    }
};

// Each visit starts with nothing chosen, so a stale pick is never one click
// from replacing the team.
watch(open, (isOpen) => {
    if (!isOpen) return;
    selected.value = null;
    if (!franchises.value.length && !loading.value) void load();
});

const franchise = computed(() => franchises.value.find((f) => f.franchise === franchiseCode.value) ?? null);

const chooseFranchise = (code: string) => {
    franchiseCode.value = code;
    selected.value = null;
    comboboxOpen.value = false;
};

const start = () => {
    if (!selected.value) return;
    emit('pick', selected.value);
    open.value = false;
};
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Start from a real team</DialogTitle>
                <DialogDescription>
                    Pick any NBA, BAA or ABA season. Its roster, coach, arena, logo and jersey fill the builder.
                </DialogDescription>
            </DialogHeader>

            <p v-if="loading" class="text-sm text-foreground/60">Loading teams…</p>
            <div v-else-if="failed" class="flex items-center gap-2 text-sm text-foreground/80">
                Couldn't load the teams.
                <Button size="sm" variant="outline" @click="load">Try again</Button>
            </div>
            <div v-else class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <Label for="real-team-franchise">Franchise</Label>
                    <Popover v-model:open="comboboxOpen">
                        <PopoverTrigger as-child>
                            <Button
                                id="real-team-franchise"
                                data-testid="real-team-franchise"
                                variant="outline"
                                role="combobox"
                                :aria-expanded="comboboxOpen"
                                class="w-full justify-between font-normal"
                            >
                                <span :class="{ 'text-muted-foreground': !franchise }">
                                    {{ franchise?.name ?? 'Choose a franchise…' }}
                                </span>
                                <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent class="franchise-list p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search franchises…" />
                                <CommandList>
                                    <CommandEmpty>No franchise found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            v-for="choice in franchises"
                                            :key="choice.franchise"
                                            :value="choice.name"
                                            @select="chooseFranchise(choice.franchise)"
                                        >
                                            <Check
                                                :class="cn('h-4 w-4', franchiseCode === choice.franchise ? 'opacity-100' : 'opacity-0')"
                                            />
                                            {{ choice.name }}
                                        </CommandItem>
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                <div v-if="franchise" class="flex flex-col gap-2">
                    <Label id="real-team-season-label">Season</Label>
                    <ScrollArea class="h-64 rounded-md border border-border">
                        <ul aria-labelledby="real-team-season-label" class="flex flex-col p-1">
                            <li v-for="season in franchise.seasons" :key="realParam(season)">
                                <button
                                    type="button"
                                    data-testid="real-team-season"
                                    :aria-pressed="selected === realParam(season)"
                                    :class="cn(
                                        'flex w-full items-baseline justify-between gap-4 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted',
                                        selected === realParam(season) && 'bg-accent font-semibold',
                                    )"
                                    @click="selected = realParam(season)"
                                >
                                    <span class="tabular-nums">{{ season.label }}</span>
                                    <span class="truncate text-foreground/60">
                                        {{ season.name }}<template v-if="season.league !== 'NBA'"> · {{ season.league }}</template>
                                    </span>
                                </button>
                            </li>
                        </ul>
                    </ScrollArea>
                </div>

                <p v-if="hasRoster && selected" class="text-sm text-foreground/80">
                    This replaces the team you're building, and it can't be undone.
                </p>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button data-testid="real-team-start" :disabled="!selected" @click="start">
                    {{ hasRoster ? 'Replace team' : 'Start team' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
.franchise-list {
    width: var(--reka-popper-anchor-width, 24rem);
}
</style>
