<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Coach, SortDirection, DrawerSide } from '@/models/types';
import coachesData from '@/assets/data/coaches.json';
import { getRandomIndex, roundValueToNPlaces } from '@/constants/utilities';
import { useCustomCoaches } from '@/composables/useCustomCoaches';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Plus,
    UserCircle2,
    Trash2,
    Search,
    ArrowUp,
    ArrowDown,
    Shuffle,
    Star,
    Trophy,
    Calendar,
    Edit2,
    Trash,
} from 'lucide-vue-next';
import CreateCustomCoachModal from './CreateCustomCoachModal.vue';
import ConfirmDialog from '@/components/ui/confirm-dialog/ConfirmDialog.vue';

const props = defineProps<{
    selectedDrawerSide: DrawerSide;
}>();

const teamCoach = defineModel<Coach | null>('teamCoach');
const showCoachDrawer = defineModel<boolean>('showCoachDrawer');

const typedCoachesData = coachesData as Coach[];

const search = ref<string>('');
const searchLoading = ref<boolean>(false);

// Custom Coaches
const { customCoaches, createCoach, updateCoach, deleteCoach: deleteCustomCoach } = useCustomCoaches();
const showCreateCoachModal = ref<boolean>(false);
const editingCoach = ref<Coach | null>(null);
const createCoachModalRef = ref<any>(null);
const showDeleteDialog = ref<boolean>(false);
const coachToDelete = ref<Coach | null>(null);

const sortOptions = [
    'Alphabetic',
    'Win Percentage',
    'Playoff Win Percentage',
    'Championships',
    'Years Coached',
    'Year Started Coaching',
];

/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const COACH_FILTERS = ['Current Season Only', 'Hall of Famer'];

const sortDirection = ref<SortDirection>('asc');

const cleanCoachesData = typedCoachesData.map((coach: Coach) => {
    const {
        l,
        w,
        wlPercent,
        playoffW,
        playoffL,
        playoffWLPercent,
        championships,
        confTitles,
        from,
        to,
    } = coach;

    return {
        ...coach,
        generalRecord: `Record: ${w} - ${l}, ${coachWinPercent(wlPercent)}`,
        playoffRecord: `Playoffs: ${playoffW} - ${playoffL}, ${coachWinPercent(
            playoffWLPercent,
        )}`,
        champsCount: `Championships: ${championships}, Conf: ${confTitles}`,
        yearsCoached: `Years Coached: ${from} - ${to}`,
    };
});

/* Computed Props */
const allCoaches = computed(() => {
    const custom = customCoaches.value.map(coach => ({ ...coach, isCustom: true }));
    const predefined = cleanCoachesData;
    return [...custom, ...predefined];
});

const sortedCoachesData = computed(() => {
    const copyCoachData = [...allCoaches.value];

    const sortModifier = sortDirection.value === 'asc' ? 1 : -1;

    switch (selectedSort.value) {
        case 'Alphabetic':
            return copyCoachData.sort((a: Coach, b: Coach) => {
                return sortModifier * a.name.localeCompare(b.name);
            });
        case 'Win Percentage':
            return copyCoachData.sort((a: Coach, b: Coach) => {
                const result =
                    parseFloat(a.wlPercent) - parseFloat(b.wlPercent);
                return sortModifier * result;
            });
        case 'Playoff Win Percentage':
            return copyCoachData.sort((a: Coach, b: Coach) => {
                const result =
                    parseFloat(a.playoffWLPercent) -
                    parseFloat(b.playoffWLPercent);
                return sortModifier * result;
            });
        case 'Championships':
            return copyCoachData.sort((a: Coach, b: Coach) => {
                const result = a.championships - b.championships;
                return sortModifier * result;
            });
        case 'Years Coached':
            return copyCoachData.sort((a: Coach, b: Coach) => {
                const aDiff = a.to - a.from;
                const bDIff = b.to - b.from;
                return sortModifier * (aDiff - bDIff);
            });
        case 'Year Started Coaching':
            return copyCoachData.sort((a: Coach, b: Coach) => {
                return sortModifier * (a.from - b.from);
            });
        default:
            return allCoaches.value;
    }
});

const filteredCoachesData = computed(() => {
    let copyCoachData = [...sortedCoachesData.value];

    /* Apply search filter */
    if (search.value.trim()) {
        const searchLower = search.value.toLowerCase().trim();
        copyCoachData = copyCoachData.filter((coach: Coach) =>
            coach.name.toLowerCase().includes(searchLower),
        );
    }

    /* Apply checkbox filters */
    if (selectedFilters.value.length > 0) {
        copyCoachData = copyCoachData.filter((coach: Coach) => {
            const { name } = coach;
            const isHallOfFamer = name.endsWith('*');

            if (selectedFilters.value.includes('Hall of Famer')) {
                if (!isHallOfFamer) {
                    return false;
                }
            }
            return true;
        });
    }

    return copyCoachData;
});

const toggleSortDirection = () => {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
};

/* Coach Select Logic */
const setCoach = (coach: any) => {
    teamCoach.value = coach;
    showCoachDrawer.value = false;
};

const deleteCoach = () => {
    teamCoach.value = null;
};

function coachWinPercent(wlPercent: string | number) {
    if (typeof wlPercent === 'number') {
        return `0%`;
    }

    return `${roundValueToNPlaces(parseFloat(wlPercent) * 100, 1)}%`;
}

const selectRandomCoach = () => {
    const copyCoachData = filteredCoachesData.value;
    const randomIndex = getRandomIndex(copyCoachData);
    teamCoach.value = copyCoachData[randomIndex];
};

const toggleFilter = (filter: string) => {
    const index = selectedFilters.value.indexOf(filter);
    if (index > -1) {
        selectedFilters.value.splice(index, 1);
    } else {
        selectedFilters.value.push(filter);
    }
};

/* Custom Coach Handlers */
const openCreateModal = () => {
    editingCoach.value = null;
    showCreateCoachModal.value = true;
};

const openEditModal = (coach: Coach) => {
    editingCoach.value = coach;
    showCreateCoachModal.value = true;
};

const handleCreateCoach = async () => {
    if (!createCoachModalRef.value) return;

    const name = createCoachModalRef.value.getName();
    const overallRating = createCoachModalRef.value.getOverallRating();
    const specialty = createCoachModalRef.value.getSpecialty();

    createCoachModalRef.value.setLoading(true);
    const result = await createCoach({ name, overallRating, specialty });
    createCoachModalRef.value.setLoading(false);

    if (result) {
        showCreateCoachModal.value = false;
        createCoachModalRef.value.reset();
    }
};

const handleUpdateCoach = async () => {
    if (!createCoachModalRef.value || !editingCoach.value?.coachUUID) return;

    const name = createCoachModalRef.value.getName();
    const overallRating = createCoachModalRef.value.getOverallRating();
    const specialty = createCoachModalRef.value.getSpecialty();

    createCoachModalRef.value.setLoading(true);
    const result = await updateCoach(editingCoach.value.coachUUID, { name, overallRating, specialty });
    createCoachModalRef.value.setLoading(false);

    if (result) {
        showCreateCoachModal.value = false;
        createCoachModalRef.value.reset();
        editingCoach.value = null;
    }
};

const openDeleteDialog = (coach: Coach) => {
    coachToDelete.value = coach;
    showDeleteDialog.value = true;
};

const handleDeleteCoach = async () => {
    if (!coachToDelete.value?.coachUUID) return;

    const coachUUID = coachToDelete.value.coachUUID;
    const coachName = coachToDelete.value.name;

    const result = await deleteCustomCoach(coachUUID, coachName);
    if (result) {
        showDeleteDialog.value = false;
        coachToDelete.value = null;

        // Clear from team if currently selected
        if (teamCoach.value?.coachUUID === coachUUID) {
            teamCoach.value = null;
        }
    }
};

const isHallOfFamer = (coachName: string) => coachName.endsWith('*');

const getCleanName = (coachName: string) => coachName.replace(/\*$/, '').trim();
</script>

<template>
    <div>
        <div class="card-wrapper">
            <Card class="section-card">
                <CardContent class="pt-6">
                    <div class="card-title-section">
                        <h3 class="card-title">Coach</h3>
                    </div>
                    <Separator class="mb-4" />
                    <div class="main-card-section">
                        <Button
                            v-if="!teamCoach"
                            size="icon"
                            variant="outline"
                            class="rounded-full h-16 w-16"
                            @click="showCoachDrawer = true"
                        >
                            <Plus class="h-8 w-8" />
                        </Button>
                        <template v-else>
                            <UserCircle2
                                class="h-16 w-16 text-muted-foreground"
                            />
                            <div class="flex items-center gap-2 mt-3">
                                <div class="coach-card-name">
                                    {{ getCleanName(teamCoach.name ?? '') }}
                                </div>
                                <Star
                                    v-if="isHallOfFamer(teamCoach.name ?? '')"
                                    class="h-4 w-4 text-yellow-500 fill-yellow-500 self-center"
                                    title="Hall of Fame"
                                />
                            </div>
                        </template>
                    </div>
                    <Separator class="my-4" />
                    <div class="flex justify-end">
                        <Button
                            @click="deleteCoach"
                            variant="ghost"
                            size="icon"
                            :class="[
                                'text-red-500 hover:text-red-600 hover:bg-red-950',
                                { 'invisible pointer-events-none': !teamCoach }
                            ]"
                        >
                            <Trash2 class="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Sheet v-model:open="showCoachDrawer">
            <SheetContent
                :side="props.selectedDrawerSide"
                class="w-[28rem] flex flex-col"
            >
                <SheetHeader>
                    <SheetTitle class="text-white text-xl"
                        >Add Coach</SheetTitle
                    >
                </SheetHeader>

                <!-- Create Custom Coach Button -->
                <Button
                    @click="openCreateModal"
                    class="mt-4 mx-1 w-auto"
                    variant="default"
                >
                    <Plus class="h-4 w-4 mr-2" />
                    Create Custom Coach
                </Button>

                <div class="drawer-header-controls">
                    <!-- Search -->
                    <div class="relative search-wrapper">
                        <Input
                            v-model="search"
                            placeholder="Search for a coach"
                            type="search"
                            class="pr-10 h-11 focus-visible:ring-offset-0"
                            style="outline-offset: -2px"
                        />
                        <Search
                            class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                        />
                    </div>

                    <!-- Sort Controls -->
                    <div class="control-row">
                        <div class="sort-button-group">
                            <Button
                                @click="toggleSortDirection"
                                size="icon"
                                variant="outline"
                                class="sort-direction-btn"
                                :title="
                                    sortDirection === 'asc'
                                        ? 'Ascending'
                                        : 'Descending'
                                "
                            >
                                <ArrowUp
                                    v-if="sortDirection === 'asc'"
                                    class="h-4 w-4"
                                />
                                <ArrowDown v-else class="h-4 w-4" />
                            </Button>
                            <Select v-model="selectedSort">
                                <SelectTrigger class="sort-select-trigger">
                                    <SelectValue placeholder="Sort by..." />
                                </SelectTrigger>
                                <SelectContent
                                    class="!bg-[rgb(9,9,11)] border-2 shadow-xl z-[100]"
                                    position="popper"
                                    :side-offset="8"
                                    style="
                                        background-color: rgb(
                                            9,
                                            9,
                                            11
                                        ) !important;
                                        opacity: 1 !important;
                                    "
                                >
                                    <SelectItem
                                        v-for="option in sortOptions"
                                        :key="option"
                                        :value="option"
                                        class="cursor-pointer hover:!bg-accent focus:!bg-accent"
                                    >
                                        {{ option }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <!-- Filter Controls -->
                    <div class="flex items-center gap-3 control-row">
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="default" class="flex-1 h-11">
                                    Filters
                                    <span
                                        v-if="selectedFilters.length > 0"
                                        class="ml-2 text-xs bg-primary-foreground text-primary rounded-full px-2 py-0.5"
                                    >
                                        {{ selectedFilters.length }}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                class="!bg-[rgb(9,9,11)] border-2 shadow-xl z-[100]"
                                :side-offset="8"
                                style="
                                    background-color: rgb(9, 9, 11) !important;
                                    opacity: 1 !important;
                                "
                            >
                                <DropdownMenuCheckboxItem
                                    v-for="filter in COACH_FILTERS"
                                    :key="filter"
                                    :checked="selectedFilters.includes(filter)"
                                    @update:checked="() => toggleFilter(filter)"
                                    class="cursor-pointer focus:!bg-accent"
                                >
                                    {{ filter }}
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            size="icon"
                            variant="default"
                            title="Select random coach"
                            @click="selectRandomCoach"
                            class="rounded-full shrink-0 w-11 h-11"
                        >
                            <Shuffle class="h-4 w-4" />
                        </Button>
                    </div>

                    <!-- Hall of Fame Legend -->
                    <div class="flex items-center justify-center gap-2 pt-2">
                        <Star class="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span class="text-sm font-medium text-muted-foreground"
                            >Hall of Fame Coach</span
                        >
                    </div>
                </div>

                <Separator class="my-4 flex-shrink-0" />

                <ScrollArea class="flex-1 overflow-auto">
                    <!-- Empty State -->
                    <div
                        v-if="filteredCoachesData.length === 0"
                        class="flex flex-col items-center justify-center py-12 px-4 text-center"
                    >
                        <UserCircle2
                            class="h-16 w-16 text-muted-foreground/50 mb-4"
                        />
                        <h3 class="text-lg font-semibold text-foreground mb-2">
                            No coaches found
                        </h3>
                        <p class="text-sm text-muted-foreground">
                            Try adjusting your search or filters
                        </p>
                    </div>

                    <!-- Coach List -->
                    <div v-else class="coach-list pr-2">
                        <div
                            v-for="coach in filteredCoachesData"
                            :key="coach.coachUUID || coach.rank"
                            class="coach-item p-4 rounded-lg transition-all relative group"
                        >
                            <div
                                @click="() => setCoach(coach)"
                                class="cursor-pointer"
                            >
                                <!-- Coach Header -->
                                <div class="flex items-center justify-between gap-2 mb-3">
                                    <div class="flex items-center gap-2 flex-1">
                                        <h3 class="coach-list-item-name">
                                            {{ getCleanName(coach.name) }}
                                        </h3>
                                        <Badge v-if="coach.isCustom" variant="secondary" class="text-xs">
                                            Custom
                                        </Badge>
                                        <Star
                                            v-if="isHallOfFamer(coach.name)"
                                            class="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0 self-center"
                                            title="Hall of Fame"
                                        />
                                    </div>

                                    <!-- Edit/Delete buttons for custom coaches -->
                                    <div
                                        v-if="coach.isCustom"
                                        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        @click.stop
                                    >
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            class="h-8 w-8 hover:bg-primary/20"
                                            @click="openEditModal(coach)"
                                        >
                                            <Edit2 class="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            class="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                                            @click="openDeleteDialog(coach)"
                                        >
                                            <Trash class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <!-- Custom Coach Stats -->
                            <div v-if="coach.isCustom" class="grid grid-cols-1 gap-2">
                                <div class="stats-row">
                                    <span class="stats-label">Overall Rating:</span>
                                    <span class="stats-value font-bold text-primary">{{ coach.overallRating }}</span>
                                </div>
                                <div class="stats-row">
                                    <span class="stats-label">Specialty:</span>
                                    <span class="stats-value">{{ coach.specialty }}</span>
                                </div>
                            </div>

                            <!-- Predefined Coach Stats -->
                            <div v-else class="grid grid-cols-1 gap-2">
                                <!-- Regular Season -->
                                <div class="stats-row">
                                    <span class="stats-label"
                                        >Regular Season:</span
                                    >
                                    <span class="stats-value"
                                        >{{ coach.w }} - {{ coach.l }} ({{
                                            coachWinPercent(coach.wlPercent)
                                        }})</span
                                    >
                                </div>

                                <!-- Playoffs -->
                                <div class="stats-row">
                                    <span class="stats-label">Playoffs:</span>
                                    <span class="stats-value"
                                        >{{ coach.playoffW }} -
                                        {{ coach.playoffL }} ({{
                                            coachWinPercent(
                                                coach.playoffWLPercent,
                                            )
                                        }})</span
                                    >
                                </div>

                                <!-- Championships -->
                                <div class="stats-row items-center gap-1.5">
                                    <Trophy
                                        class="h-3.5 w-3.5 text-yellow-500"
                                    />
                                    <span class="stats-value"
                                        >{{
                                            coach.championships
                                        }}
                                        Championship{{
                                            coach.championships !== 1
                                                ? 's'
                                                : ''
                                        }}, {{ coach.confTitles }} Conf. Title{{
                                            coach.confTitles !== 1 ? 's' : ''
                                        }}</span
                                    >
                                </div>

                                <!-- Years -->
                                <div class="stats-row items-center gap-1.5">
                                    <Calendar
                                        class="h-3.5 w-3.5 text-muted-foreground"
                                    />
                                    <span class="stats-value"
                                        >{{ coach.from }} - {{ coach.to }}</span
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>

        <!-- Create/Edit Coach Modal -->
        <CreateCustomCoachModal
            ref="createCoachModalRef"
            v-model:open="showCreateCoachModal"
            :editing-coach="editingCoach"
            @created="handleCreateCoach"
            @updated="handleUpdateCoach"
        />

        <!-- Delete Confirmation Dialog -->
        <ConfirmDialog
            v-model:open="showDeleteDialog"
            title="Delete Custom Coach?"
            :description="`Are you sure you want to delete ${coachToDelete?.name}? This action cannot be undone.`"
            confirm-text="Delete"
            variant="destructive"
            @confirm="handleDeleteCoach"
        />
    </div>
</template>

<style scoped>
.card-wrapper {
    border-radius: 0.5rem;
    border: 0.125rem solid;
    border-color: hsla(var(--primary), 0.5);
    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
}

.card-wrapper:hover {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0.5rem hsla(var(--primary), 0.3);
}

.section-card {
    border: none !important;
}

.card-title-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
}

.card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.main-card-section {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 10rem;
}

.coach-name {
    font-size: 1rem;
    font-weight: 500;
    text-align: center;
}

.coach-item {
    background-color: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    transition: all 0.2s ease;
}

.coach-item:hover {
    background-color: hsl(var(--accent) / 0.15);
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Coach name displayed on the main card after selection */
.coach-card-name {
    font-size: 1rem;
    font-weight: 500;
    text-align: center;
    color: hsl(var(--foreground));
    line-height: 1.3;
}

/* Coach names in the drawer selection list */
.coach-list-item-name {
    font-size: 1rem;
    font-weight: 700;
    color: hsl(var(--foreground));
    line-height: 1.3;
}

.stats-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
}

.stats-label {
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    min-width: fit-content;
}

.stats-value {
    color: hsl(var(--foreground) / 0.9);
}

/* Dropdown backgrounds - fully opaque - CRITICAL FIX */
:deep(.sort-dropdown-content),
:deep(.sort-dropdown-content) > *,
:deep([data-reka-select-content].sort-dropdown-content) {
    background-color: rgb(9, 9, 11) !important;
    background: rgb(9, 9, 11) !important;
    opacity: 1 !important;
}

:deep(.filters-dropdown-content),
:deep(.filters-dropdown-content) > *,
:deep([data-reka-dropdown-menu-content].filters-dropdown-content) {
    background-color: rgb(9, 9, 11) !important;
    background: rgb(9, 9, 11) !important;
    opacity: 1 !important;
}

/* Drawer controls spacing */
.drawer-header-controls {
    margin-top: 1.5rem;
    padding: 0 0.25rem;
}

.search-wrapper {
    margin-bottom: 1.25rem;
    isolation: isolate;
}

.search-wrapper :deep(input:focus) {
    outline-offset: -0.125rem;
}

.control-row {
    margin-bottom: 1.5rem;
}

/* Coach list spacing */
.coach-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* Sort button group */
.sort-button-group {
    display: flex;
    gap: 0.5rem;
    width: 100%;
}

.sort-direction-btn {
    flex-shrink: 0;
    width: 2.75rem;
    height: 2.75rem;
}

.sort-select-trigger {
    flex: 1;
    height: 2.75rem;
}
</style>
