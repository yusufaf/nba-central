<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import type { Player, PlayerPosition } from '@/models/types';
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

const props = defineProps<{
    editingPlayer?: Player | null;
}>();

const emit = defineEmits<{
    created: [];
    updated: [];
}>();

const open = defineModel<boolean>('open');

const positions: { value: PlayerPosition; label: string }[] = [
    { value: 'PG', label: 'PG - Point Guard' },
    { value: 'SG', label: 'SG - Shooting Guard' },
    { value: 'SF', label: 'SF - Small Forward' },
    { value: 'PF', label: 'PF - Power Forward' },
    { value: 'C', label: 'C - Center' },
];

const name = ref('');
const position = ref<PlayerPosition>('SG');
const heightFeet = ref(6);
const heightInches = ref(6);
const weight = ref(200);
const overallRating = ref(75);
const loading = ref(false);

const isEditMode = computed(() => !!props.editingPlayer);
const dialogTitle = computed(() => isEditMode.value ? 'Edit Player' : 'Create Custom Player');
const submitButtonText = computed(() => isEditMode.value ? 'Update Player' : 'Create Player');

const heightDisplay = computed(() => {
    return `${heightFeet.value}'${heightInches.value}"`;
});

const isFormValid = computed(() => {
    return name.value.trim().length > 0 &&
           name.value.trim().length <= 100 &&
           heightFeet.value >= 4 &&
           heightFeet.value <= 8 &&
           heightInches.value >= 0 &&
           heightInches.value <= 11 &&
           weight.value >= 100 &&
           weight.value <= 400 &&
           overallRating.value >= 0 &&
           overallRating.value <= 99;
});

watch(() => props.editingPlayer, (newVal) => {
    if (newVal) {
        name.value = newVal.name || newVal.fullName || '';
        position.value = (newVal.position as PlayerPosition) || 'SG';
        heightFeet.value = newVal.heightFeet || 6;
        heightInches.value = newVal.heightInches || 6;
        weight.value = newVal.weightPounds || 200;
        overallRating.value = newVal.overallRating || 75;
    }
}, { immediate: true });

watch(open, (newVal) => {
    if (!newVal) {
        resetForm();
    }
});

const resetForm = () => {
    name.value = '';
    position.value = 'SG';
    heightFeet.value = 6;
    heightInches.value = 6;
    weight.value = 200;
    overallRating.value = 75;
    loading.value = false;
};

const handleSubmit = () => {
    if (!isFormValid.value) {
        toast.error('Please enter valid player details');
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
    getPosition: () => position.value,
    getHeightFeet: () => heightFeet.value,
    getHeightInches: () => heightInches.value,
    getWeight: () => weight.value,
    getOverallRating: () => overallRating.value,
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
                    {{ isEditMode ? 'Update the player details below.' : 'Enter the details for your custom player.' }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-4">
                <!-- Name Input -->
                <div class="grid gap-2">
                    <Label for="player-name">
                        Name <span class="text-red-500">*</span>
                    </Label>
                    <Input
                        id="player-name"
                        v-model="name"
                        placeholder="Enter player name"
                        maxlength="100"
                        :disabled="loading"
                        class="h-11"
                    />
                    <p class="text-xs text-muted-foreground">
                        {{ name.length }}/100 characters
                    </p>
                </div>

                <!-- Position Selection -->
                <div class="grid gap-2">
                    <Label for="player-position">
                        Position <span class="text-red-500">*</span>
                    </Label>
                    <Select v-model="position" :disabled="loading">
                        <SelectTrigger class="h-11">
                            <SelectValue placeholder="Select position..." />
                        </SelectTrigger>
                        <SelectContent
                            class="!bg-[rgb(9,9,11)] border-2 shadow-xl"
                            position="popper"
                        >
                            <SelectItem
                                v-for="pos in positions"
                                :key="pos.value"
                                :value="pos.value"
                                class="cursor-pointer hover:!bg-accent focus:!bg-accent"
                            >
                                {{ pos.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <!-- Physical Attributes Grid -->
                <div class="grid grid-cols-2 gap-4">
                    <!-- Height -->
                    <div class="grid gap-2">
                        <Label>
                            Height <span class="text-red-500">*</span>
                        </Label>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <Input
                                    v-model.number="heightFeet"
                                    type="number"
                                    min="4"
                                    max="8"
                                    :disabled="loading"
                                    class="h-11"
                                    placeholder="Feet"
                                />
                            </div>
                            <div>
                                <Input
                                    v-model.number="heightInches"
                                    type="number"
                                    min="0"
                                    max="11"
                                    :disabled="loading"
                                    class="h-11"
                                    placeholder="Inches"
                                />
                            </div>
                        </div>
                        <p class="text-xs text-muted-foreground text-center">
                            {{ heightDisplay }}
                        </p>
                    </div>

                    <!-- Weight -->
                    <div class="grid gap-2">
                        <Label for="player-weight">
                            Weight (lbs) <span class="text-red-500">*</span>
                        </Label>
                        <Input
                            id="player-weight"
                            v-model.number="weight"
                            type="number"
                            min="100"
                            max="400"
                            :disabled="loading"
                            class="h-11"
                            placeholder="Weight"
                        />
                        <p class="text-xs text-muted-foreground text-center">
                            {{ weight }} lbs
                        </p>
                    </div>
                </div>

                <!-- Overall Rating Input -->
                <div class="grid gap-2">
                    <Label for="player-rating">
                        Overall Rating <span class="text-red-500">*</span>
                    </Label>
                    <div class="flex items-center gap-3">
                        <Input
                            id="player-rating"
                            v-model.number="overallRating"
                            type="range"
                            min="0"
                            max="99"
                            :disabled="loading"
                            class="flex-1 h-2 cursor-pointer"
                        />
                        <div class="text-2xl font-bold text-primary w-12 text-center">
                            {{ overallRating }}
                        </div>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        0 (Poor) - 99 (Elite)
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
/* Range slider styling */
input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    background: transparent;
    padding: 0;
    margin: 0;
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: hsl(var(--primary));
    cursor: pointer;
    border: 2px solid hsl(var(--background));
    box-shadow: 0 0 0.5rem hsla(var(--primary), 0.5);
    margin-top: -0.375rem;
}

input[type="range"]::-moz-range-thumb {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: hsl(var(--primary));
    cursor: pointer;
    border: 2px solid hsl(var(--background));
    box-shadow: 0 0 0.5rem hsla(var(--primary), 0.5);
    border: none;
}

input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 0.5rem;
    border-radius: 0.25rem;
    background: linear-gradient(to right,
        hsl(var(--destructive)) 0%,
        hsl(var(--warning)) 50%,
        hsl(var(--primary)) 100%);
}

input[type="range"]::-moz-range-track {
    width: 100%;
    height: 0.5rem;
    border-radius: 0.25rem;
    background: linear-gradient(to right,
        hsl(var(--destructive)) 0%,
        hsl(var(--warning)) 50%,
        hsl(var(--primary)) 100%);
}

/* Number input spinner removal */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

input[type="number"] {
    -moz-appearance: textfield;
}
</style>
