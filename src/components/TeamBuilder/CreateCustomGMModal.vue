<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import type { GM, NBATeam } from '@/models/types';
import nbaTeamsData from '@/assets/data/nbaTeams.json';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-vue-next';

const props = defineProps<{
    editingGM?: GM | null;
}>();

const emit = defineEmits<{
    created: [];
    updated: [];
}>();

const open = defineModel<boolean>('open');

const nbaTeams = nbaTeamsData as NBATeam[];

const name = ref('');
const selectedTeams = ref<string[]>([]);
const loading = ref(false);

const isEditMode = computed(() => !!props.editingGM);
const dialogTitle = computed(() => isEditMode.value ? 'Edit General Manager' : 'Create Custom General Manager');
const submitButtonText = computed(() => isEditMode.value ? 'Update GM' : 'Create GM');

const isFormValid = computed(() => {
    return name.value.trim().length > 0 && name.value.trim().length <= 100;
});

const availableTeams = computed(() => {
    return nbaTeams.filter(team => !selectedTeams.value.includes(team.abbr));
});

watch(() => props.editingGM, (newVal) => {
    if (newVal) {
        name.value = newVal.name;
        selectedTeams.value = [...(newVal.teams || [])];
    }
}, { immediate: true });

watch(open, (newVal) => {
    if (!newVal) {
        resetForm();
    }
});

const resetForm = () => {
    name.value = '';
    selectedTeams.value = [];
    loading.value = false;
};

const addTeam = (teamAbbr: string) => {
    if (teamAbbr && !selectedTeams.value.includes(teamAbbr)) {
        selectedTeams.value.push(teamAbbr);
    }
};

const removeTeam = (teamAbbr: string) => {
    selectedTeams.value = selectedTeams.value.filter(t => t !== teamAbbr);
};

const handleSubmit = () => {
    if (!isFormValid.value) {
        toast.error('Please enter a valid name (1-100 characters)');
        return;
    }

    if (isEditMode.value) {
        emit('updated');
    } else {
        emit('created');
    }
};

const handleCancel = () => {
    open.value = false;
    resetForm();
};

defineExpose({
    getName: () => name.value.trim(),
    getTeams: () => selectedTeams.value,
    setLoading: (val: boolean) => {
        loading.value = val;
    },
    reset: resetForm,
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-[35rem]">
            <DialogHeader>
                <DialogTitle>{{ dialogTitle }}</DialogTitle>
                <DialogDescription>
                    {{ isEditMode ? 'Update the GM details below.' : 'Enter the details for your custom general manager.' }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-4">
                <!-- Name Input -->
                <div class="grid gap-2">
                    <Label for="gm-name">
                        Name <span class="text-red-500">*</span>
                    </Label>
                    <Input
                        id="gm-name"
                        v-model="name"
                        placeholder="Enter GM name"
                        maxlength="100"
                        :disabled="loading"
                        class="h-11"
                    />
                    <p class="text-xs text-muted-foreground">
                        {{ name.length }}/100 characters
                    </p>
                </div>

                <!-- Teams Selection -->
                <div class="grid gap-2">
                    <Label for="gm-teams">
                        Teams (Optional)
                    </Label>
                    <div class="space-y-2">
                        <!-- Selected Teams Display -->
                        <div
                            v-if="selectedTeams.length > 0"
                            class="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50 min-h-[3rem]"
                        >
                            <Badge
                                v-for="teamAbbr in selectedTeams"
                                :key="teamAbbr"
                                variant="secondary"
                                class="flex items-center gap-1 px-2 py-1"
                            >
                                {{ teamAbbr }}
                                <button
                                    type="button"
                                    @click="removeTeam(teamAbbr)"
                                    class="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                    :disabled="loading"
                                >
                                    <X class="h-3 w-3" />
                                </button>
                            </Badge>
                        </div>
                        <div
                            v-else
                            class="flex items-center justify-center p-3 border rounded-lg bg-muted/50 min-h-[3rem] text-sm text-muted-foreground"
                        >
                            No teams selected
                        </div>

                        <!-- Team Selector -->
                        <Select @update:model-value="addTeam" :disabled="loading || availableTeams.length === 0">
                            <SelectTrigger class="h-11">
                                <SelectValue placeholder="Add a team..." />
                            </SelectTrigger>
                            <SelectContent
                                class="!bg-[rgb(9,9,11)] border-2 shadow-xl max-h-[15rem]"
                                position="popper"
                            >
                                <SelectItem
                                    v-for="team in availableTeams"
                                    :key="team.abbr"
                                    :value="team.abbr"
                                    class="cursor-pointer hover:!bg-accent focus:!bg-accent"
                                >
                                    {{ team.abbr }} - {{ team.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Select teams this GM has managed ({{ selectedTeams.length }}/30 selected)
                    </p>
                </div>
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    @click="handleCancel"
                    :disabled="loading"
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    @click="handleSubmit"
                    :disabled="!isFormValid || loading"
                >
                    {{ loading ? 'Saving...' : submitButtonText }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
:deep(.dialog-content) {
    max-height: 90vh;
    overflow-y: auto;
}
</style>
