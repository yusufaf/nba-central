<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ImagePlus } from 'lucide-vue-next';
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
import type { CustomArena, CustomArenaPayload } from '@/models/api';
import type { ArenaPhotoChange } from '@/composables/useCustomArenas';
import { parseCapacity } from '@/utils/arenaDetails';
import { resizeArenaPhoto } from '@/utils/arenaImage';
import { validateAvatarFile } from '@/utils/avatarImage';

// #117 and #118 add Court and Drawing tabs next to these details.
const props = defineProps<{
    editingArena?: CustomArena | null;
    saving?: boolean;
}>();

const emit = defineEmits<{
    submit: [data: CustomArenaPayload, photo: ArenaPhotoChange];
}>();

const open = defineModel<boolean>('open');

const NAME_MAX = 60;
const LOCATION_MAX = 60;

const name = ref('');
const location = ref('');
const capacity = ref('');
const openedYear = ref('');
const photo = ref<ArenaPhotoChange>(undefined);
const newPhotoUrl = ref<string | null>(null);
const photoError = ref<string | null>(null);
const preparingPhoto = ref(false);
// Bumped on every reset, so a resize that finishes after the dialog was
// closed or reopened for another arena is dropped, not attached to it.
let formGeneration = 0;

const isEditMode = computed(() => !!props.editingArena);

const setNewPhotoUrl = (url: string | null) => {
    if (newPhotoUrl.value) URL.revokeObjectURL(newPhotoUrl.value);
    newPhotoUrl.value = url;
};

const reset = () => {
    formGeneration++;
    preparingPhoto.value = false;
    const arena = props.editingArena;
    name.value = arena?.name ?? '';
    location.value = arena?.location ?? '';
    capacity.value = arena?.capacity != null ? String(arena.capacity) : '';
    openedYear.value = arena?.openedYear != null ? String(arena.openedYear) : '';
    photo.value = undefined;
    setNewPhotoUrl(null);
    photoError.value = null;
};

watch(open, (isOpen) => {
    if (isOpen) reset();
});
watch(() => props.editingArena, () => {
    if (open.value) reset();
});
onBeforeUnmount(() => setNewPhotoUrl(null));

// null = left blank, NaN = not a number at all.
const parseOptional = (value: string) => (value.trim() === '' ? null : (parseCapacity(value.trim()) ?? Number.NaN));

const capacityValue = computed(() => parseOptional(capacity.value));
const openedYearValue = computed(() => (/^\s*\d*\s*$/.test(openedYear.value) ? parseOptional(openedYear.value) : Number.NaN));

const isWholeIn = (value: number | null, min: number, max: number) =>
    value === null || (Number.isInteger(value) && value >= min && value <= max);

const capacityInvalid = computed(() => !isWholeIn(capacityValue.value, 1, 200_000));
const openedYearInvalid = computed(() => !isWholeIn(openedYearValue.value, 1850, 2100));

const isFormValid = computed(
    () =>
        name.value.trim().length > 0 &&
        name.value.trim().length <= NAME_MAX &&
        location.value.trim().length <= LOCATION_MAX &&
        !capacityInvalid.value &&
        !openedYearInvalid.value &&
        !preparingPhoto.value,
);

const shownPhoto = computed(() => {
    if (photo.value === null) return null;
    return newPhotoUrl.value ?? props.editingArena?.photoUrl ?? null;
});

const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    photoError.value = validateAvatarFile(file);
    if (photoError.value) return;
    const generation = formGeneration;
    preparingPhoto.value = true;
    try {
        const resized = await resizeArenaPhoto(file);
        if (generation !== formGeneration) return;
        photo.value = resized;
        setNewPhotoUrl(URL.createObjectURL(resized));
    } catch (err) {
        if (generation !== formGeneration) return;
        photoError.value = err instanceof Error ? err.message : "That photo couldn't be used.";
    } finally {
        if (generation === formGeneration) preparingPhoto.value = false;
    }
};

const onFileInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    void choosePhoto(input.files?.[0]);
    // Choosing the same file again should still fire.
    input.value = '';
};

const onDrop = (event: DragEvent) => {
    void choosePhoto(event.dataTransfer?.files?.[0]);
};

const removePhoto = () => {
    setNewPhotoUrl(null);
    // Removing a photo that was never saved just drops it.
    photo.value = props.editingArena?.photoUrl ? null : undefined;
};

const handleSubmit = () => {
    if (!isFormValid.value) return;
    emit(
        'submit',
        {
            name: name.value.trim(),
            location: location.value.trim(),
            capacity: capacityValue.value,
            openedYear: openedYearValue.value,
            court: props.editingArena?.court ?? null,
        },
        photo.value,
    );
};
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent
            size="wide"
            class="max-w-[min(95vw,56rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
            <DialogHeader>
                <DialogTitle>{{ isEditMode ? 'Edit arena' : 'Create arena' }}</DialogTitle>
                <DialogDescription>
                    Your arena shows up in the Arena drawer next to the NBA ones.
                </DialogDescription>
            </DialogHeader>

            <form class="@container grid gap-5" @submit.prevent="handleSubmit">
                <div class="grid gap-4 @min-[32rem]:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="arena-name">
                            Name <span class="text-destructive-strong">*</span>
                        </Label>
                        <Input
                            id="arena-name"
                            v-model="name"
                            :maxlength="NAME_MAX"
                            placeholder="Harbor Pavilion"
                            :disabled="saving"
                            class="h-11"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="arena-location">City</Label>
                        <Input
                            id="arena-location"
                            v-model="location"
                            :maxlength="LOCATION_MAX"
                            placeholder="Seattle, Washington"
                            :disabled="saving"
                            class="h-11"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="arena-capacity">Capacity</Label>
                        <Input
                            id="arena-capacity"
                            v-model="capacity"
                            inputmode="numeric"
                            placeholder="18,600"
                            :disabled="saving"
                            :aria-invalid="capacityInvalid"
                            aria-describedby="arena-capacity-hint"
                            class="h-11"
                        />
                        <p
                            id="arena-capacity-hint"
                            class="text-xs"
                            :class="capacityInvalid ? 'text-destructive-strong' : 'text-muted-foreground'"
                        >
                            {{ capacityInvalid ? 'Enter a whole number from 1 to 200,000.' : 'Optional. 1 – 200,000' }}
                        </p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="arena-opened">Opened</Label>
                        <Input
                            id="arena-opened"
                            v-model="openedYear"
                            inputmode="numeric"
                            maxlength="4"
                            placeholder="2026"
                            :disabled="saving"
                            :aria-invalid="openedYearInvalid"
                            aria-describedby="arena-opened-hint"
                            class="h-11"
                        />
                        <p
                            id="arena-opened-hint"
                            class="text-xs"
                            :class="openedYearInvalid ? 'text-destructive-strong' : 'text-muted-foreground'"
                        >
                            {{ openedYearInvalid ? 'Enter a year from 1850 to 2100.' : 'Optional. 1850 – 2100, future years allowed' }}
                        </p>
                    </div>
                </div>

                <div class="grid gap-2">
                    <Label for="arena-photo">Photo</Label>
                    <p class="text-xs text-muted-foreground">
                        Optional. PNG, JPEG or WebP, resized in the browser, 1 MB max.
                    </p>

                    <div v-if="shownPhoto" class="grid gap-3 @min-[32rem]:grid-cols-[16rem_1fr] @min-[32rem]:items-end">
                        <img
                            :src="shownPhoto"
                            alt="Arena photo"
                            class="aspect-video w-full rounded-md border border-border object-cover"
                        />
                        <div class="flex flex-wrap gap-2">
                            <Button as="label" for="arena-photo" variant="outline" :disabled="saving" class="cursor-pointer">
                                Replace photo
                            </Button>
                            <Button type="button" variant="ghost" :disabled="saving" class="text-destructive-strong hover:bg-destructive/10 hover:text-destructive-strong" @click="removePhoto">
                                Remove photo
                            </Button>
                        </div>
                    </div>
                    <label
                        v-else
                        for="arena-photo"
                        class="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary-strong hover:bg-primary/5"
                        @dragover.prevent
                        @drop.prevent="onDrop"
                    >
                        <ImagePlus class="mb-1 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                        <span class="text-sm font-medium">
                            {{ preparingPhoto ? 'Preparing photo…' : 'Drop an image or choose a file' }}
                        </span>
                        <span class="text-sm text-muted-foreground">Shown in the drawer and on the arena tile.</span>
                    </label>
                    <input
                        id="arena-photo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        class="sr-only"
                        :disabled="saving"
                        @change="onFileInput"
                    />
                    <p v-if="photoError" role="alert" class="text-sm text-destructive-strong">{{ photoError }}</p>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" :disabled="saving" @click="open = false">
                        Cancel
                    </Button>
                    <Button type="submit" :disabled="!isFormValid || saving">
                        {{ saving ? 'Saving…' : isEditMode ? 'Save arena' : 'Create arena' }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
