<script setup lang="ts">
import { ref, computed } from "vue";
import type { GM, SortDirection, DrawerSide } from "@/models/types";
import gmData from "@/assets/data/execs.json";
import { getRandomIndex } from "@/constants/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetClose,
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
import {
    Plus,
    UserCircle2,
    Trash2,
    Search,
    ArrowUp,
    ArrowDown,
    Shuffle,
    X,
} from "lucide-vue-next";

const props = defineProps<{
    selectedDrawerSide: DrawerSide;
}>();

const teamGM = defineModel<any>("teamGM");
const showGMDrawer = defineModel<boolean>("showGMDrawer");

const typedGMData = gmData as GM[];

const search = ref<string>("");
const searchLoading = ref<boolean>(false);

const sortOptions = ["Alphabetic"];

/* Sorting and Filtering */
const selectedSort = ref<string | null>(null);
const selectedFilters = ref<string[]>([]);
const GM_FILTERS = ["Western Conference", "Eastern Conference"];
const sortDirection = ref<SortDirection>("asc");

/* Computed Props */
const sortedGMData = computed(() => {
    const copyGMData = [...typedGMData];

    const sortModifier = sortDirection.value === "asc" ? 1 : -1;

    switch (selectedSort.value) {
        case "Alphabetic":
            return copyGMData.sort((a: any, b: any) => {
                return sortModifier * a.name.localeCompare(b.name);
            });
        default:
            return typedGMData;
    }
});

const filteredGMData = computed(() => {
    let copyGMData = [...sortedGMData.value];

    /* Apply search filter */
    if (search.value.trim()) {
        const searchLower = search.value.toLowerCase().trim();
        copyGMData = copyGMData.filter((gm: any) =>
            gm.name.toLowerCase().includes(searchLower)
        );
    }

    /* Apply checkbox filters - Note: GM filters not implemented yet */
    if (selectedFilters.value.length > 0) {
        // Filter logic would go here when implemented
        return copyGMData;
    }

    return copyGMData;
});

const toggleSortDirection = () => {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
};

/* GM Select Logic */
const setGM = (gm: any) => {
    teamGM.value = gm;
    showGMDrawer.value = false;
};

const deleteGM = () => {
    teamGM.value = null;
};

const selectRandomGM = () => {
    const copyGMData = filteredGMData.value;
    const randomIndex = getRandomIndex(copyGMData);
    teamGM.value = copyGMData[randomIndex];
};

const toggleFilter = (filter: string) => {
    const index = selectedFilters.value.indexOf(filter);
    if (index > -1) {
        selectedFilters.value.splice(index, 1);
    } else {
        selectedFilters.value.push(filter);
    }
};
</script>

<template>
    <div>
        <div class="card-wrapper">
            <Card class="section-card">
                <CardContent class="pt-6">
                <div class="card-title-section">
                    <h3 class="card-title">General Manager</h3>
                </div>
                <Separator class="mb-4" />
                <div class="main-card-section">
                    <Button
                        v-if="!teamGM"
                        size="icon"
                        variant="outline"
                        class="rounded-full h-16 w-16"
                        @click="showGMDrawer = true"
                    >
                        <Plus class="h-8 w-8" />
                    </Button>
                    <template v-else>
                        <UserCircle2 class="h-16 w-16 text-muted-foreground" />
                        <div class="gm-name">{{ teamGM.name }}</div>
                    </template>
                </div>
                <Separator class="my-4" />
                <div class="flex justify-end">
                    <Button
                        @click="deleteGM"
                        variant="ghost"
                        size="icon"
                        class="text-red-500 hover:text-red-600 hover:bg-red-950"
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
        </div>

        <Sheet v-model:open="showGMDrawer">
            <SheetContent
                :side="props.selectedDrawerSide"
                class="w-[28rem] flex flex-col"
            >
                <SheetHeader>
                    <SheetTitle class="text-white text-xl">Add GM</SheetTitle>
                </SheetHeader>

                <div class="drawer-header-controls">
                    <!-- Search -->
                    <div class="relative search-wrapper">
                        <Input
                            v-model="search"
                            placeholder="Search for a GM"
                            type="search"
                            class="pr-10 h-11 focus-visible:ring-offset-0"
                            style="outline-offset: -0.125rem;"
                        />
                        <Search class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
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
                                    class="!bg-[rgb(9,9,11)] border-2 shadow-xl z-[100]"
                                    position="popper"
                                    :side-offset="8"
                                    style="background-color: rgb(9, 9, 11) !important; opacity: 1 !important;"
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
                                class="!bg-[rgb(9,9,11)] border-2 shadow-xl z-[100]"
                                :side-offset="8"
                                style="background-color: rgb(9, 9, 11) !important; opacity: 1 !important;"
                            >
                                <DropdownMenuCheckboxItem
                                    v-for="filter in GM_FILTERS"
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
                            title="Select random GM"
                            @click="selectRandomGM"
                            class="rounded-full shrink-0 w-11 h-11"
                        >
                            <Shuffle class="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Separator class="my-4 flex-shrink-0" />

                <ScrollArea class="flex-1 overflow-auto">
                    <!-- Empty State -->
                    <div v-if="filteredGMData.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <UserCircle2 class="h-16 w-16 text-muted-foreground/50 mb-4" />
                        <h3 class="text-lg font-semibold text-foreground mb-2">No GMs found</h3>
                        <p class="text-sm text-muted-foreground">
                            Try adjusting your search or filters
                        </p>
                    </div>

                    <!-- GM List -->
                    <div v-else class="gm-list pr-2">
                        <div
                            v-for="(gm, index) in filteredGMData"
                            :key="index"
                            @click="() => setGM(gm)"
                            class="gm-item p-4 cursor-pointer rounded-lg transition-all"
                        >
                            <div class="gm-name-improved font-bold text-base">{{ gm.name }}</div>
                        </div>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    </div>
</template>

<style scoped>
.card-wrapper {
    border-radius: 0.5rem;
    border: 0.125rem solid;
    border-color: hsla(var(--primary), 0.5);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
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

.gm-name {
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

/* GM list spacing */
.gm-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.gm-item {
    background-color: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    transition: all 0.2s ease;
}

.gm-item:hover {
    background-color: hsl(var(--accent) / 0.15);
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.15);
}

.gm-name-improved {
    color: hsl(var(--foreground));
    line-height: 1.3;
}
</style>
