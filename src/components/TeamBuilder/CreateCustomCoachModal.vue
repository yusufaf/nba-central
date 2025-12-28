<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import type { Coach, CoachSpecialty } from '@/models/types';
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
    editingCoach?: Coach | null;
}>();

const emit = defineEmits<{
    created: [];
    updated: [];
}>();

const open = defineModel<boolean>('open');

const specialties: { value: CoachSpecialty; label: string }[] = [
    { value: 'Offensive', label: 'Offensive Minded' },
    { value: 'Defensive', label: 'Defensive Minded' },
    { value: 'Balanced', label: 'Balanced' },
];

const name = ref('');
const overallRating = ref(75);
const specialty = ref<CoachSpecialty>('Balanced');
const loading = ref(false);

const isEditMode = computed(() => !!props.editingCoach);
const dialogTitle = computed(() => isEditMode.value ? 'Edit Coach' : 'Create Custom Coach');
const submitButtonText = computed(() => isEditMode.value ? 'Update Coach' : 'Create Coach');

const isFormValid = computed(() => {
    return name.value.trim().length > 0 &&
           name.value.trim().length <= 100 &&
           overallRating.value >= 0 &&
           overallRating.value <= 99;
});

watch(() => props.editingCoach, (newVal) => {
    if (newVal) {
        name.value = newVal.name;
        overallRating.value = newVal.overallRating || 75;
        specialty.value = newVal.specialty || 'Balanced';
    }
}, { immediate: true });

watch(open, (newVal) => {
    if (!newVal) {
        resetForm();
    }
});

const resetForm = () => {
    name.value = '';
    overallRating.value = 75;
    specialty.value = 'Balanced';
    loading.value = false;
};

const handleSubmit = () => {
    if (!isFormValid.value) {
        toast.error('Please enter a valid name (1-100 characters) and rating (0-99)');
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
    getOverallRating: () => overallRating.value,
    getSpecialty: () => specialty.value,
    setLoading: (val: boolean) => {
        loading.value = val;
    },
    reset: resetForm,
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-[32rem]">
            <DialogHeader>
                <DialogTitle>{{ dialogTitle }}</DialogTitle>
                <DialogDescription>
                    {{ isEditMode ? 'Update the coach details below.' : 'Enter the details for your custom coach.' }}
                </DialogDescription>
            </DialogHeader>

            <div class="grid gap-4 py-4">
                <!-- Name Input -->
                <div class="grid gap-2">
                    <Label for="coach-name">
                        Name <span class="text-red-500">*</span>
                    </Label>
                    <Input
                        id="coach-name"
                        v-model="name"
                        placeholder="Enter coach name"
                        maxlength="100"
                        :disabled="loading"
                        class="h-11"
                    />
                    <p class="text-xs text-muted-foreground">
                        {{ name.length }}/100 characters
                    </p>
                </div>

                <!-- Overall Rating Input -->
                <div class="grid gap-2">
                    <Label for="coach-rating">
                        Overall Rating <span class="text-red-500">*</span>
                    </Label>
                    <div class="flex items-center gap-3">
                        <Input
                            id="coach-rating"
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

                <!-- Specialty Selection -->
                <div class="grid gap-2">
                    <Label for="coach-specialty">
                        Coaching Specialty <span class="text-red-500">*</span>
                    </Label>
                    <Select v-model="specialty" :disabled="loading">
                        <SelectTrigger class="h-11">
                            <SelectValue placeholder="Select specialty..." />
                        </SelectTrigger>
                        <SelectContent
                            class="!bg-[rgb(9,9,11)] border-2 shadow-xl"
                            position="popper"
                        >
                            <SelectItem
                                v-for="spec in specialties"
                                :key="spec.value"
                                :value="spec.value"
                                class="cursor-pointer hover:!bg-accent focus:!bg-accent"
                            >
                                {{ spec.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
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
</style>
