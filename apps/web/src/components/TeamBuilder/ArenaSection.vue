<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { toast } from "vue-sonner";
import { CONFERENCE_FILTER_TEAMS } from "@/constants/constants";
import type { Arena, SortDirection, DrawerSide } from "@/models/types";
import type { CustomArena, CustomArenaPayload } from "@/models/api";
import arenaData from "@/assets/data/arenas.json";
import { getRandomIndex, getWikipediaUrl } from "@/constants/utilities";
import ExternalLinksMenu from "@/components/ExternalLinksMenu.vue";
import { useCurrentUser } from "@/composables/useCurrentUser";
import { useCustomArenas, type ArenaPhotoChange } from "@/composables/useCustomArenas";
import type { BuilderArena } from "@/composables/useTeamPersistence";
import { arenaDetails, formatCapacity, parseCapacity } from "@/utils/arenaDetails";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import ConfirmDialog from "@/components/ui/confirm-dialog/ConfirmDialog.vue";
import CreateCustomArenaModal from "./CreateCustomArenaModal.vue";
import {
    Plus,
    Trash2,
    Search,
    ArrowUp,
    ArrowDown,
    Shuffle,
    Pencil,
    Building2,
} from "lucide-vue-next";

const props = defineProps<{
    selectedDrawerSide: DrawerSide;
}>();

const teamArena = defineModel<BuilderArena | null>("teamArena");
const showArenaDrawer = defineModel<boolean>("showArenaDrawer");

const typedArenaData = arenaData as Arena[];

const { currentUser } = useCurrentUser();
const { customArenas, loading: savingArena, saveArena, deleteArena: deleteCustomArena } =
    useCustomArenas();

const search = ref<string>("");

const sortOptions = ["Alphabetic", "Capacity"];

/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const ARENA_FILTERS = ["Western Conference", "Eastern Conference"];
const sortDirection = ref<SortDirection>("asc");

type ListedArena = Arena | CustomArena;

const sortArenas = <T extends ListedArena>(arenas: T[]): T[] => {
    const copy = [...arenas];
    const sortModifier = sortDirection.value === "asc" ? 1 : -1;

    switch (selectedSort.value) {
        case "Alphabetic":
            return copy.sort((a, b) => sortModifier * a.name.localeCompare(b.name));
        case "Capacity":
            return copy.sort(
                (a, b) =>
                    sortModifier *
                    ((parseCapacity(a.capacity) ?? 0) - (parseCapacity(b.capacity) ?? 0)),
            );
        default:
            return copy;
    }
};

const matchesSearch = (arena: ListedArena) => {
    const searchLower = search.value.toLowerCase().trim();
    return !searchLower || arena.name.toLowerCase().includes(searchLower);
};

/* Computed Props */
// The conference filter is about NBA teams, so it hides your arenas while on.
const visibleCustomArenas = computed(() =>
    selectedFilters.value.length > 0
        ? []
        : sortArenas(customArenas.value.filter(matchesSearch)),
);

const filteredArenaData = computed(() => {
    let copyArenaData = sortArenas(typedArenaData).filter(matchesSearch);

    /* Apply checkbox filters - a team only needs to match one selected
       conference, not all of them. */
    if (selectedFilters.value.length > 0) {
        copyArenaData = copyArenaData.filter((arena: Arena) =>
            selectedFilters.value.some((filter) =>
                CONFERENCE_FILTER_TEAMS[filter]?.includes(arena.team)
            )
        );
    }

    return copyArenaData;
});

const hasResults = computed(
    () => visibleCustomArenas.value.length > 0 || filteredArenaData.value.length > 0,
);

/* The card */
// A linked custom arena shows the live copy from the list, so an edit made
// in the dialog shows here straight away. Anything else shows as stored.
const liveArena = computed(() => {
    const arena = teamArena.value;
    const arenaUUID = arena && "arenaUUID" in arena ? arena.arenaUUID : undefined;
    return arenaUUID ? (customArenas.value.find((a) => a.arenaUUID === arenaUUID) ?? null) : null;
});

const shownArena = computed(() => liveArena.value ?? teamArena.value ?? null);

const shownImage = computed(() => {
    const arena = shownArena.value;
    if (!arena) return null;
    return ("photoUrl" in arena && arena.photoUrl) || ("imgLink" in arena && arena.imgLink) || null;
});

const isCustomArena = (arena: BuilderArena | null) => !!arena && "isCustom" in arena && !!arena.isCustom;

// A photo that fails to load (an old link, a deleted object) falls back to
// the placeholder instead of a broken image.
const imageFailed = ref(false);
watch(shownImage, () => {
    imageFailed.value = false;
});

const toggleSortDirection = () => {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
};

/* Arena Select Logic */
const setArena = (arena: ListedArena) => {
    teamArena.value = arena;
    showArenaDrawer.value = false;
};

const deleteArena = () => {
    teamArena.value = null;
};

const selectRandomArena = () => {
    const candidates: ListedArena[] = [...visibleCustomArenas.value, ...filteredArenaData.value];
    if (candidates.length === 0) return;
    teamArena.value = candidates[getRandomIndex(candidates)];
};

const toggleFilter = (filter: string) => {
    const index = selectedFilters.value.indexOf(filter);
    if (index > -1) {
        selectedFilters.value.splice(index, 1);
    } else {
        selectedFilters.value.push(filter);
    }
};

/* Custom arenas */
const showArenaModal = ref(false);
const editingArena = ref<CustomArena | null>(null);
const showDeleteDialog = ref(false);
const arenaToDelete = ref<CustomArena | null>(null);

const openCreateModal = () => {
    if (!currentUser.value) {
        toast.info("Sign in to create your own arenas");
        return;
    }
    editingArena.value = null;
    showArenaModal.value = true;
};

const openEditModal = (arena: CustomArena) => {
    editingArena.value = arena;
    showArenaModal.value = true;
};

const handleSubmitArena = async (data: CustomArenaPayload, photo: ArenaPhotoChange) => {
    const saved = await saveArena(editingArena.value?.arenaUUID ?? null, data, photo);
    if (saved) {
        showArenaModal.value = false;
        editingArena.value = null;
    }
};

const openDeleteDialog = (arena: CustomArena) => {
    arenaToDelete.value = arena;
    showDeleteDialog.value = true;
};

const handleDeleteArena = async () => {
    const arena = arenaToDelete.value;
    if (!arena) return;
    if (!(await deleteCustomArena(arena))) return;
    showDeleteDialog.value = false;
    arenaToDelete.value = null;

    // A team keeps a deleted arena's details, without the link or photo -
    // the same thing a reload shows.
    const onTeam = teamArena.value;
    if (onTeam && "arenaUUID" in onTeam && onTeam.arenaUUID === arena.arenaUUID) {
        teamArena.value = {
            name: arena.name,
            location: arena.location || undefined,
            capacity: arena.capacity ?? undefined,
            openedYear: arena.openedYear ?? undefined,
            isCustom: true,
        };
    }
};
</script>

<template>
    <div>
        <div class="card-wrapper">
            <Card class="section-card border-0">
                <CardContent class="pt-6">
                <div class="card-title-section">
                    <h3 class="card-title">Arena</h3>
                </div>
                <Separator class="mb-4" />
                <div class="main-card-section">
                    <Button
                        v-if="!shownArena"
                        size="icon"
                        variant="outline"
                        class="rounded-full h-16 w-16"
                        aria-label="Add arena"
                        @click="showArenaDrawer = true"
                    >
                        <Plus class="h-8 w-8" />
                    </Button>
                    <template v-else>
                        <img
                            v-if="shownImage && !imageFailed"
                            :src="shownImage"
                            alt=""
                            class="arena-card-image rounded object-cover shadow-md"
                            @error="imageFailed = true"
                        />
                        <div v-else class="arena-card-image arena-image-placeholder rounded" data-testid="arena-placeholder">
                            <Building2 class="h-8 w-8" aria-hidden="true" />
                        </div>
                        <div class="flex items-center justify-center gap-2 mt-3">
                            <div class="arena-name !mt-0">{{ shownArena.name }}</div>
                            <Badge v-if="isCustomArena(shownArena)" variant="secondary" class="text-xs uppercase">Custom</Badge>
                            <ExternalLinksMenu
                                v-else
                                :links="[{ label: 'Wikipedia', url: getWikipediaUrl(shownArena.name) }]"
                            />
                        </div>
                        <div v-if="arenaDetails(shownArena)" class="arena-details">
                            {{ arenaDetails(shownArena) }}
                        </div>
                        <Button
                            v-if="liveArena"
                            variant="outline"
                            size="sm"
                            class="mt-3"
                            @click="openEditModal(liveArena)"
                        >
                            Edit arena
                        </Button>
                    </template>
                </div>
                <Separator class="my-4" />
                <div class="flex justify-end">
                    <Button
                        @click="deleteArena"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove arena from team"
                        :class="[
                            'text-destructive-strong hover:text-destructive-strong hover:bg-destructive/10',
                            { 'invisible pointer-events-none': !teamArena }
                        ]"
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
        </div>

        <Sheet v-model:open="showArenaDrawer">
            <SheetContent
                :side="props.selectedDrawerSide"
                class="w-[28rem] max-w-full flex flex-col"
            >
                <SheetHeader>
                    <SheetTitle class="text-foreground text-xl">Add Arena</SheetTitle>
                </SheetHeader>

                <Button
                    @click="openCreateModal"
                    class="mt-4 mx-1 w-auto"
                    variant="default"
                >
                    <Plus class="h-4 w-4 mr-2" />
                    Create arena
                </Button>

                <div class="drawer-header-controls">
                    <!-- Search -->
                    <div class="relative search-wrapper">
                        <Input
                            v-model="search"
                            placeholder="Search for an arena"
                            type="search"
                            class="pr-10 h-11 focus-visible:ring-offset-0 outline-offset-[-0.125rem]"
                        />
                        <Search class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>

                    <!-- Sort Controls -->
                    <div class="control-row">
                        <div class="sort-button-group">
                            <Button
                                @click="toggleSortDirection"
                                size="icon"
                                variant="outline"
                                class="sort-direction-btn"
                                :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
                            >
                                <ArrowUp v-if="sortDirection === 'asc'" class="h-4 w-4" />
                                <ArrowDown v-else class="h-4 w-4" />
                            </Button>
                            <Select v-model="selectedSort">
                                <SelectTrigger class="sort-select-trigger">
                                    <SelectValue placeholder="Sort by..." />
                                </SelectTrigger>
                                <SelectContent
                                    class="bg-surface-raised border-2 shadow-xl"
                                    position="popper"
                                    :side-offset="8"
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
                                    <span v-if="selectedFilters.length > 0" class="ml-2 text-xs bg-primary-foreground text-primary rounded-full px-2 py-0.5">
                                        {{ selectedFilters.length }}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                class="bg-surface-raised border-2 shadow-xl"
                                :side-offset="8"
                            >
                                <DropdownMenuCheckboxItem
                                    v-for="filter in ARENA_FILTERS"
                                    :key="filter"
                                    :model-value="selectedFilters.includes(filter)"
                                    @update:model-value="() => toggleFilter(filter)"
                                    class="cursor-pointer focus:!bg-accent"
                                >
                                    {{ filter }}
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            size="icon"
                            variant="default"
                            title="Select random arena"
                            @click="selectRandomArena"
                            class="rounded-full shrink-0 w-11 h-11"
                        >
                            <Shuffle class="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Separator class="my-4 flex-shrink-0" />

                <!-- -mr-6 cancels the Sheet's own right padding (p-6) so the
                     scrollbar rides the panel's true edge instead of sitting
                     1.5rem in from it; arena-list's pr-6 puts that space back
                     as room for the cards, clear of the scrollbar itself. -->
                <ScrollArea class="flex-1 -mr-6">
                    <!-- Empty State -->
                    <div v-if="!hasResults" class="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Building2 class="h-16 w-16 text-muted-foreground/50 mb-4" aria-hidden="true" />
                        <h3 class="text-lg font-semibold text-foreground mb-2">No arenas found</h3>
                        <p class="text-sm text-muted-foreground">
                            Try adjusting your search or filters
                        </p>
                    </div>

                    <div v-else class="pr-6">
                        <section v-if="visibleCustomArenas.length > 0" aria-labelledby="your-arenas-heading" class="arena-group">
                            <h4 id="your-arenas-heading" class="arena-group-heading">Your arenas</h4>
                            <div class="arena-list">
                                <div
                                    v-for="arena in visibleCustomArenas"
                                    :key="arena.arenaUUID"
                                    class="arena-item p-4 rounded-lg transition-all flex gap-3"
                                    data-testid="custom-arena-item"
                                >
                                    <button
                                        type="button"
                                        class="flex flex-1 min-w-0 gap-3 text-left cursor-pointer"
                                        @click="setArena(arena)"
                                    >
                                        <img
                                            v-if="arena.photoUrl"
                                            :src="arena.photoUrl"
                                            alt=""
                                            class="arena-list-image rounded-md object-cover flex-shrink-0"
                                        />
                                        <span v-else class="arena-list-image arena-image-placeholder rounded-md flex-shrink-0">
                                            <Building2 class="h-5 w-5" aria-hidden="true" />
                                        </span>
                                        <span class="flex-1 min-w-0">
                                            <Badge variant="secondary" class="text-xs uppercase mb-1">Custom</Badge>
                                            <span class="arena-name-improved block font-bold text-base mb-2">{{ arena.name }}</span>
                                            <span v-if="arena.capacity" class="block text-sm text-muted-foreground">Capacity: {{ formatCapacity(arena.capacity) }}</span>
                                            <span v-if="arena.openedYear" class="block text-sm text-muted-foreground">Opened {{ arena.openedYear }}</span>
                                        </span>
                                    </button>
                                    <div class="flex flex-col gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            class="h-8 w-8 hover:bg-primary/20"
                                            :aria-label="`Edit ${arena.name}`"
                                            @click="openEditModal(arena)"
                                        >
                                            <Pencil class="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            class="h-8 w-8 hover:bg-destructive/20 hover:text-destructive-strong"
                                            :aria-label="`Delete ${arena.name}`"
                                            @click="openDeleteDialog(arena)"
                                        >
                                            <Trash2 class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section
                            v-if="filteredArenaData.length > 0"
                            :aria-labelledby="visibleCustomArenas.length > 0 ? 'nba-arenas-heading' : undefined"
                            class="arena-group"
                        >
                            <h4 v-if="visibleCustomArenas.length > 0" id="nba-arenas-heading" class="arena-group-heading">NBA arenas</h4>
                            <div class="arena-list">
                                <div
                                    v-for="arena in filteredArenaData"
                                    :key="arena.name"
                                    @click="() => setArena(arena)"
                                    class="arena-item p-4 cursor-pointer rounded-lg transition-all flex gap-3"
                                >
                                    <img :src="arena.imgLink" alt="" class="arena-list-image rounded-md object-cover flex-shrink-0" />
                                    <div class="flex-1 min-w-0">
                                        <div class="arena-name-improved font-bold text-base mb-2">{{ arena.name }}</div>
                                        <div class="text-sm text-muted-foreground">Capacity: {{ arena.capacity }}</div>
                                        <div class="text-sm text-muted-foreground">Opened {{ arena.openedYear }}</div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>

        <CreateCustomArenaModal
            v-model:open="showArenaModal"
            :editing-arena="editingArena"
            :saving="savingArena"
            @submit="handleSubmitArena"
        />

        <ConfirmDialog
            v-model:open="showDeleteDialog"
            title="Delete arena?"
            :description="`${arenaToDelete?.name} and its photo will be deleted. Teams that use it keep its name and details. This can't be undone.`"
            confirm-text="Delete"
            variant="destructive"
            :loading="savingArena"
            @confirm="handleDeleteArena"
        />
    </div>
</template>
<style scoped>
.card-wrapper {
    border-radius: 0.5rem;
    border: 0.125rem solid;
    border-color: hsl(var(--primary) / 0.5);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.card-wrapper:hover {
    border-color: hsl(var(--primary-strong));
    box-shadow: 0 0 0.5rem hsl(var(--primary) / 0.3);
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

.arena-name {
    margin-top: 0.75rem;
    font-size: 1rem;
    font-weight: 500;
    text-align: center;
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

/* Arena list spacing */
.arena-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.arena-item {
    background-color: hsl(var(--card));
    border: 0.0625rem solid hsl(var(--border));
    transition: all 0.2s ease;
}

.arena-item:hover {
    background-color: hsl(var(--accent) / 0.15);
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0.125rem 0.5rem hsl(var(--shadow-color) / 0.15);
}

.arena-name-improved {
    color: hsl(var(--foreground));
    line-height: 1.3;
}

/* 3:2, close to the Wikimedia thumbnails' own shape. */
.arena-card-image {
    width: 10rem;
    aspect-ratio: 3 / 2;
}

.arena-list-image {
    width: 5.625rem;
    height: 3.75rem;
}

/* Custom arenas without a photo, and photos that fail to load. */
.arena-image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    border: 0.0625rem dashed hsl(var(--border));
}

.arena-details {
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    text-align: center;
}

.arena-group + .arena-group {
    margin-top: 1.5rem;
}

.arena-group-heading {
    margin-bottom: 0.75rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: hsl(var(--muted-foreground));
}
</style>
