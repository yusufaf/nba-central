<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CourtFloor from '@/components/court/CourtFloor.vue';
import CourtDesignFields from './CourtDesignFields.vue';
import type { CourtDesign, CustomArena, CustomArenaPayload } from '@/models/api';
import type { ArenaImageChanges } from '@/composables/useCustomArenas';
import { useImageChoice } from '@/composables/useImageChoice';
import { parseCapacity } from '@/utils/arenaDetails';
import { resizeArenaPhoto, resizeCourtLogo } from '@/utils/arenaImage';
import { centreLogoUrl, courtModes, newCourt, type ApronMode, type LinesMode } from '@/utils/court';

// #118 adds a Drawing tab next to these.
const props = defineProps<{
    editingArena?: CustomArena | null;
    saving?: boolean;
    // The logo of the team being built, for a "Team logo" centre in the preview.
    teamLogo?: string;
}>();

const emit = defineEmits<{
    submit: [data: CustomArenaPayload, images: ArenaImageChanges];
}>();

const open = defineModel<boolean>('open');

const NAME_MAX = 60;
const LOCATION_MAX = 60;

const tab = ref<'details' | 'court'>('details');
const name = ref('');
const location = ref('');
const capacity = ref('');
const openedYear = ref('');
const court = ref<CourtDesign | null>(null);
// Kept here, not in the Court tab, which unmounts while Details shows.
const apronMode = ref<ApronMode>('match');
const linesMode = ref<LinesMode>('custom');
const photo = useImageChoice(resizeArenaPhoto, "That photo couldn't be used.");
const logo = useImageChoice(resizeCourtLogo, "That logo couldn't be used.");

const isEditMode = computed(() => !!props.editingArena);

const setCourt = (next: CourtDesign | null) => {
    court.value = next;
    if (next) ({ apron: apronMode.value, lines: linesMode.value } = courtModes(next));
};

const reset = () => {
    const arena = props.editingArena;
    tab.value = 'details';
    name.value = arena?.name ?? '';
    location.value = arena?.location ?? '';
    capacity.value = arena?.capacity != null ? String(arena.capacity) : '';
    openedYear.value = arena?.openedYear != null ? String(arena.openedYear) : '';
    setCourt(arena?.court ? { ...arena.court } : null);
    photo.reset();
    logo.reset();
};

watch(
    open,
    (isOpen) => {
        if (isOpen) reset();
    },
    { immediate: true },
);
watch(() => props.editingArena, () => {
    if (open.value) reset();
});

// null = left blank, NaN = not a number at all.
const parseOptional = (value: string) => (value.trim() === '' ? null : (parseCapacity(value.trim()) ?? Number.NaN));

const capacityValue = computed(() => parseOptional(capacity.value));
const openedYearValue = computed(() => (/^\s*\d*\s*$/.test(openedYear.value) ? parseOptional(openedYear.value) : Number.NaN));

const isWholeIn = (value: number | null, min: number, max: number) =>
    value === null || (Number.isInteger(value) && value >= min && value <= max);

const capacityInvalid = computed(() => !isWholeIn(capacityValue.value, 1, 200_000));
const openedYearInvalid = computed(() => !isWholeIn(openedYearValue.value, 1850, 2100));

const shownPhoto = computed(() => photo.shown(props.editingArena?.photoUrl));
const shownLogo = computed(() => logo.shown(props.editingArena?.logoUrl));
const previewLogo = computed(() =>
    centreLogoUrl(court.value, { teamLogo: props.teamLogo, uploadedLogo: shownLogo.value }),
);
// "Upload" with no image would save a court with an empty centre circle.
const logoMissing = computed(() => court.value?.centerLogo === 'upload' && !shownLogo.value);

const isFormValid = computed(
    () =>
        name.value.trim().length > 0 &&
        name.value.trim().length <= NAME_MAX &&
        location.value.trim().length <= LOCATION_MAX &&
        !capacityInvalid.value &&
        !openedYearInvalid.value &&
        !photo.preparing.value &&
        !logo.preparing.value &&
        !logoMissing.value,
);

const onPhotoInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    void photo.choose(input.files?.[0]);
    // Choosing the same file again should still fire.
    input.value = '';
};

const onPhotoDrop = (event: DragEvent) => {
    void photo.choose(event.dataTransfer?.files?.[0]);
};

const addCourt = () => {
    setCourt(newCourt(name.value));
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
            court: court.value
                ? {
                      ...court.value,
                      baselineText: court.value.baselineText.trim(),
                      sidelineText: court.value.sidelineText.trim(),
                  }
                : null,
        },
        { photo: photo.change.value, logo: logo.change.value },
    );
};
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent size="sheet">
            <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="handleSubmit">
                <DialogHeader class="px-6 pt-6 pr-16 text-left">
                    <DialogTitle>{{ isEditMode ? 'Edit arena' : 'Create arena' }}</DialogTitle>
                    <DialogDescription>
                        Your arena shows up in the Arena drawer next to the NBA ones.
                    </DialogDescription>
                </DialogHeader>

                <Tabs v-model="tab" class="flex min-h-0 flex-1 flex-col">
                    <TabsList class="mx-6 mt-4 self-start">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="court">Court</TabsTrigger>
                    </TabsList>

                    <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                        <TabsContent value="details" class="mt-0 grid gap-5 pt-4">
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
                                        <Button type="button" variant="ghost" :disabled="saving" class="text-destructive-strong hover:bg-destructive/10 hover:text-destructive-strong" @click="photo.remove(!!editingArena?.photoUrl)">
                                            Remove photo
                                        </Button>
                                    </div>
                                </div>
                                <label
                                    v-else
                                    for="arena-photo"
                                    class="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary-strong hover:bg-primary/5"
                                    @dragover.prevent
                                    @drop.prevent="onPhotoDrop"
                                >
                                    <ImagePlus class="mb-1 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                                    <span class="text-sm font-medium">
                                        {{ photo.preparing.value ? 'Preparing photo…' : 'Drop an image or choose a file' }}
                                    </span>
                                    <span class="text-sm text-muted-foreground">Shown in the drawer and on the arena tile.</span>
                                </label>
                                <input
                                    id="arena-photo"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    class="sr-only"
                                    :disabled="saving"
                                    @change="onPhotoInput"
                                />
                                <p v-if="photo.error.value" role="alert" class="text-sm text-destructive-strong">{{ photo.error.value }}</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="court" class="mt-0 pt-4">
                            <div v-if="court" class="grid gap-5">
                                <CourtDesignFields
                                    v-model:court="court"
                                    v-model:apron-mode="apronMode"
                                    v-model:lines-mode="linesMode"
                                    :logo-url="previewLogo"
                                    :uploaded-logo="shownLogo"
                                    :logo-preparing="logo.preparing.value"
                                    :logo-error="logo.error.value"
                                    :logo-missing="logoMissing"
                                    :disabled="saving"
                                    @choose-logo="logo.choose"
                                    @remove-logo="logo.remove(!!editingArena?.logoUrl)"
                                />
                                <div>
                                    <Button type="button" variant="ghost" size="sm" :disabled="saving" class="text-destructive-strong hover:bg-destructive/10 hover:text-destructive-strong" @click="court = null">
                                        Remove court
                                    </Button>
                                </div>
                            </div>
                            <div v-else class="grid justify-items-center gap-4 py-6 text-center">
                                <div class="aspect-[104/58] w-full max-w-sm overflow-hidden rounded-lg opacity-60" aria-hidden="true">
                                    <CourtFloor :court="newCourt('')" decorative />
                                </div>
                                <p class="max-w-sm text-sm text-muted-foreground">
                                    This arena has no court yet. A court shows behind your starting five, on your public team page and on the share card.
                                </p>
                                <Button type="button" :disabled="saving" @click="addCourt">Design a court</Button>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter class="flex-row justify-end gap-2 border-t border-border px-6 py-4 *:flex-1 @min-[32rem]:*:flex-none">
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
