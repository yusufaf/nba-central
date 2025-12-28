<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
    VIEW_OPTIONS,
    DRAWER_OPTIONS,
    ESPN_TEAM_URL,
} from '@/constants/constants';
import axios from 'axios';
import TeamCustomizationDialog from './TeamCustomizationDialog.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    ChevronDown,
    ChevronUp,
    MoreVertical,
    Share2,
    RotateCcw,
    Save,
    Pencil,
} from 'lucide-vue-next';

const emit = defineEmits(['reset', 'saveTeam']);

/* 2-Way Bound Props */
const headerExpanded = defineModel<boolean>('headerExpanded');
const teamName = defineModel<string>('teamName');
const teamDescription = defineModel<string>('teamDescription');
const teamCity = defineModel<string>('teamCity');
const teamCountry = defineModel<string>('teamCountry');
const selectedView = defineModel<string>('selectedView');
const teamLogo = defineModel<string>('teamLogo');
const drawerSide = defineModel<string>('drawerSide');

const showConfirm = ref<boolean>(false);
const showTeamCustomizationDialog = ref<boolean>(false);

const nbaTeamLogos = ref<any[]>([]);

const resetClick = () => {
    showConfirm.value = true;
};

const resetConfirm = () => {
    emit('reset');
    showConfirm.value = false;
};

const saveClick = () => {
    emit('saveTeam');
};

const expandClick = () => {
    headerExpanded.value = !headerExpanded.value;
};

const toggleCustomizationDialog = () => {
    showTeamCustomizationDialog.value = !showTeamCustomizationDialog.value;
};

const fetchAllTeamLogos = async () => {
    const tempLogos: any[] = [];
    for (let i = 1; i < 31; i++) {
        const url = `${ESPN_TEAM_URL}${i}`;
        const response = await axios.get(url);
        const { team } = response.data;
        console.log({ team });

        const logos = team.logos;

        /* Take the first logo for now */
        const logo = logos[0];
        tempLogos.push(logo);
    }
    console.log('Fetched team logos:', tempLogos);

    /* Sort the logos alphabetically */
    nbaTeamLogos.value = tempLogos.sort((a, b) => {
        const hrefSplitA = a.href.split('/');
        const teamAbbrA = a.href.split('/')[hrefSplitA.length - 1];

        const hrefSplitB = b.href.split('/');
        const teamAbbrB = b.href.split('/')[hrefSplitB.length - 1];

        return teamAbbrA.localeCompare(teamAbbrB);
    });
};

onMounted(() => {
    fetchAllTeamLogos();
});
</script>

<template>
    <div class="header">
        <div class="header-content">
            <div class="header-left">
                <div class="team-info">
                    <Label for="team-name" class="text-sm text-muted-foreground font-medium">Team Name</Label>
                    <Input
                        id="team-name"
                        v-model="teamName"
                        placeholder="Enter team name..."
                        class="team-name-input"
                    />
                </div>
                <Button
                    @click="toggleCustomizationDialog"
                    size="icon"
                    variant="ghost"
                    title="Team settings"
                    class="settings-btn"
                >
                    <Pencil class="h-4 w-4" />
                </Button>
            </div>

            <div class="header-center">
                <div class="score-display">
                    <span class="score-label">Team Score</span>
                    <span class="score-value">N/A</span>
                </div>
            </div>

            <div class="header-right">
                <div class="action-buttons">
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <Button
                                size="sm"
                                variant="outline"
                                title="Settings"
                            >
                                <MoreVertical class="h-4 w-4 mr-2" />
                                Settings
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-72 settings-dropdown">
                            <div class="p-4 space-y-4">
                                <div>
                                    <Label class="text-sm font-medium mb-2 block">Drawer Side</Label>
                                    <ToggleGroup
                                        v-model="drawerSide"
                                        type="single"
                                        class="toggle-group"
                                        @update:model-value="(value) => { if (!value) drawerSide = 'right' }"
                                    >
                                        <ToggleGroupItem
                                            v-for="option in DRAWER_OPTIONS"
                                            :key="option.value"
                                            :value="option.value"
                                            class="toggle-item capitalize"
                                        >
                                            {{ option.label }}
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </div>
                                <div>
                                    <Label class="text-sm font-medium mb-2 block">View Mode</Label>
                                    <ToggleGroup
                                        v-model="selectedView"
                                        type="single"
                                        class="toggle-group"
                                        @update:model-value="(value) => { if (!value) selectedView = 'Default' }"
                                    >
                                        <ToggleGroupItem
                                            v-for="option in VIEW_OPTIONS"
                                            :key="option.value"
                                            :value="option.value"
                                            class="toggle-item"
                                        >
                                            {{ option.label }}
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        @click="resetClick"
                        size="sm"
                        variant="outline"
                        title="Reset team"
                    >
                        <RotateCcw class="h-4 w-4 mr-2" />
                        Reset
                    </Button>
                    <Button
                        @click="saveClick"
                        size="sm"
                        variant="default"
                        title="Save team"
                        class="font-extrabold shadow-md save-button"
                    >
                        <Save class="h-4 w-4 mr-2" />
                        Save
                    </Button>
                </div>
            </div>
        </div>

        <!-- Confirm Dialog -->
        <ConfirmDialog
            v-model:open="showConfirm"
            title="Reset Team"
            description="Are you sure you want to reset your whole team? This action cannot be undone."
            confirm-text="Reset Team"
            cancel-text="Cancel"
            variant="destructive"
            @confirm="resetConfirm"
        />
    </div>
    <TeamCustomizationDialog
        :nbaTeamLogos
        v-model:showTeamCustomizationDialog="showTeamCustomizationDialog"
        v-model:teamDescription="teamDescription"
        v-model:teamCity="teamCity"
        v-model:teamCountry="teamCountry"
        v-model:teamLogo="teamLogo"
    />
</template>

<style scoped>
.header {
    padding: 1.25rem 1.5rem;
    background-color: hsl(var(--card));
}

.header-content {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 2rem;
}

.header-left {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    justify-self: start;
}

.team-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.team-name-input {
    width: 18rem;
    font-size: 1rem;
}

.settings-btn {
    margin-bottom: 0.125rem;
}

.header-center {
    display: flex;
    justify-content: center;
}

.score-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
}

.score-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.score-value {
    font-size: 1.875rem;
    font-weight: 700;
    color: hsl(var(--foreground));
    line-height: 1;
}

.header-right {
    display: flex;
    align-items: center;
    justify-self: end;
}

.action-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.toggle-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 0.25rem;
    background-color: hsl(var(--muted) / 0.3);
    border: 1px solid hsl(var(--border));
    border-radius: 0.375rem;
    padding: 0.25rem;
}

.toggle-item {
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 1rem;
}

:deep(.toggle-item[data-state="on"]) {
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.3);
}

.capitalize {
    text-transform: capitalize;
}

/* Settings Dropdown - Solid Background */
:deep(.settings-dropdown) {
    background-color: rgb(24, 24, 27) !important;
    border: 1.5px solid rgb(63, 63, 70) !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7) !important;
    backdrop-filter: blur(12px);
}

/* Save Button - More Visible Text */
.save-button {
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground)) !important;
    font-weight: 800 !important;
}

.save-button:hover {
    background-color: hsl(var(--primary) / 0.9);
}

/* Responsive */
@media (max-width: 1200px) {
    .header-content {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }

    .header-left,
    .header-center,
    .header-right {
        justify-self: center;
    }

    .header-left {
        width: 100%;
        max-width: 32rem;
    }

    .team-name-input {
        flex: 1;
        min-width: 0;
    }

    .action-buttons {
        justify-content: center;
        flex-wrap: wrap;
    }
}

@media (max-width: 640px) {
    .header {
        padding: 1rem;
    }

    .score-value {
        font-size: 1.5rem;
    }

    .header-left {
        flex-direction: column;
        align-items: stretch;
    }

    .team-info {
        width: 100%;
    }

    .team-name-input {
        width: 100%;
    }

    .settings-btn {
        align-self: center;
        margin-bottom: 0;
    }

    .action-buttons {
        flex-direction: column;
        width: 100%;
    }

    .action-buttons > * {
        width: 100%;
    }
}
</style>
