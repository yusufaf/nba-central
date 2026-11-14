<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PersonPreview3DAsync, Scene3DUnavailable } from '@/components/scene3d';
import { previewPerson } from '@/components/scene3d/people';
import {
    FACIAL_HAIR_STYLES,
    HAIR_STYLES,
    POSES,
    type FacialHairId,
    type HairStyleId,
    type PersonAppearance,
    type PoseId,
} from '@/constants/appearance';
import { track } from '@/lib/analytics';
import type { Player, PlayerPosition } from '@/models/types';
import { DEFAULT_APPEARANCE, parseAppearance } from '@/utils/appearance';
import {
    FACIAL_HAIR_LABELS,
    HAIR_LABELS,
    HAIR_SWATCHES,
    POSE_LABELS,
    appearanceLabel,
    facialHairFits,
    fits,
    forFrame,
    type BodyProfile,
} from '@/utils/appearanceOptions';
import { isJerseyNumber } from '@/utils/rosterNumbers';
import { isWebGLAvailable } from '@/utils/webgl';
import ColourField from './ColourField.vue';
import CreatorBodyTab from './CreatorBodyTab.vue';
import type { CustomPlayerPayload } from './types';

const props = withDefaults(defineProps<{ editingPlayer?: Player | null; saving?: boolean }>(), {
    editingPlayer: null,
    saving: false,
});
const emit = defineEmits<{ submit: [data: CustomPlayerPayload] }>();
const open = defineModel<boolean>('open', { default: false });

const POSITIONS: { value: PlayerPosition; label: string }[] = [
    { value: 'PG', label: 'PG - Point Guard' },
    { value: 'SG', label: 'SG - Shooting Guard' },
    { value: 'SF', label: 'SF - Small Forward' },
    { value: 'PF', label: 'PF - Power Forward' },
    { value: 'C', label: 'C - Center' },
];
const NAME_MAX = 100;

const name = ref('');
const position = ref<PlayerPosition>('SG');
const profile = ref<BodyProfile>({ heightFeet: 6, heightInches: 6, weightPounds: 200 });
const overallRating = ref(75);
const look = ref<PersonAppearance>(structuredClone(DEFAULT_APPEARANCE));
const tab = ref('profile');
const webgl = ref(true);
const numberDraft = ref('');

const isEditMode = computed(() => !!props.editingPlayer);

// Numbers seed with ??, not ||: a stored 0 (6'0", a 0 rating) is a value.
const seed = () => {
    const player = props.editingPlayer;
    name.value = player ? player.name || player.fullName || '' : '';
    position.value = (player?.position as PlayerPosition) || 'SG';
    profile.value = {
        heightFeet: player?.heightFeet ?? 6,
        heightInches: player?.heightInches ?? 6,
        weightPounds: player?.weightPounds ?? 200,
    };
    overallRating.value = player?.overallRating ?? 75;
    // A player saved before looks existed starts from the default one.
    // A hand-made look can carry a cut that doesn't fit its frame: map it,
    // so the Hair tab shows what the preview shows.
    const stored = parseAppearance(player?.appearance);
    look.value = stored ? forFrame(stored, stored.frame) : structuredClone(DEFAULT_APPEARANCE);
    numberDraft.value = look.value.jerseyNumber ?? '';
    tab.value = 'profile';
};

watch(
    open,
    (isOpen) => {
        if (!isOpen) return;
        seed();
        webgl.value = isWebGLAvailable();
        track('creator_opened', { kind: 'player', mode: isEditMode.value ? 'edit' : 'create' });
    },
    { immediate: true },
);
watch(
    () => props.editingPlayer,
    () => {
        if (open.value) seed();
    },
);

// Leaves out the name and rating: neither changes the figure, so typing
// them doesn't rebuild it.
const preview = computed(() => previewPerson({ position: position.value, ...profile.value }, look.value));
const previewLabel = computed(() => appearanceLabel(name.value.trim() || 'your player', look.value));

const within = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
const isFormValid = computed(() => {
    const trimmed = name.value.trim();
    return (
        trimmed.length > 0 &&
        trimmed.length <= NAME_MAX &&
        within(profile.value.heightFeet, 4, 8) &&
        within(profile.value.heightInches, 0, 11) &&
        within(profile.value.weightPounds, 100, 400) &&
        within(overallRating.value, 0, 99)
    );
});

const hairStyles = computed(() => HAIR_STYLES.filter((style) => fits(look.value.frame, style)));
const facialStyles = computed(() => FACIAL_HAIR_STYLES.filter((style) => facialHairFits(look.value.frame, style)));

// reka clears a single toggle when its selected item is clicked again;
// every look field is required, so a clear is ignored.
const chooseHair = (style: unknown) => {
    if (!style) return;
    look.value = { ...look.value, hair: { ...look.value.hair, style: style as HairStyleId } };
};
const chooseFacialHair = (style: unknown) => {
    if (!style) return;
    const next = style as FacialHairId;
    // A first beard starts in the hair's colour.
    const color = look.value.facialHair.style === 'none' && next !== 'none' ? look.value.hair.color : look.value.facialHair.color;
    look.value = { ...look.value, facialHair: { style: next, color } };
};
const choosePose = (pose: unknown) => {
    if (!pose) return;
    look.value = { ...look.value, pose: pose as PoseId };
};
const setRating = (value: number[] | undefined) => {
    if (value) overallRating.value = Math.round(value[0]);
};

const numberInvalid = computed(() => numberDraft.value.trim() !== '' && !isJerseyNumber(numberDraft.value.trim()));
const setNumber = (value: string | number) => {
    numberDraft.value = String(value);
    const typed = numberDraft.value.trim();
    if (typed === '') {
        const rest = { ...look.value };
        delete rest.jerseyNumber;
        look.value = rest;
    } else if (isJerseyNumber(typed)) {
        look.value = { ...look.value, jerseyNumber: typed };
    }
};

const submit = () => {
    if (!isFormValid.value || props.saving) return;
    emit('submit', {
        name: name.value.trim(),
        position: position.value,
        ...profile.value,
        overallRating: overallRating.value,
        // A plain copy: the look holds reactive proxies, which structuredClone refuses.
        appearance: JSON.parse(JSON.stringify(look.value)) as PersonAppearance,
    });
};
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent size="sheet">
            <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
                <DialogHeader class="px-6 pt-6 pr-16 text-left">
                    <DialogTitle>{{ isEditMode ? 'Edit player' : 'Create player' }}</DialogTitle>
                    <DialogDescription>Changes show in the preview as you make them.</DialogDescription>
                </DialogHeader>

                <!-- One scroller. In a narrow sheet the preview and the tab list
                     stay pinned at its top, so focused controls are scrolled to
                     just below them (scroll-padding), never behind. -->
                <div
                    class="creator-scroller min-h-0 flex-1 overflow-y-auto px-6 pb-6"
                    data-testid="creator-scroller"
                >
                    <div class="flex flex-col @min-[44rem]:grid @min-[44rem]:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @min-[44rem]:items-start @min-[44rem]:gap-6">
                        <div class="sticky top-0 z-[var(--z-sticky)] -mx-6 bg-card px-6 pt-4 pb-2 @min-[44rem]:mx-0 @min-[44rem]:px-0">
                            <div class="creator-preview">
                                <PersonPreview3DAsync v-if="webgl" :person="preview" :label="previewLabel" />
                                <Scene3DUnavailable v-else reason="no-webgl" />
                            </div>
                        </div>

                        <Tabs v-model="tab" class="creator-tabs-column flex min-w-0 flex-col">
                            <TabsList
                                class="creator-tabs sticky z-[var(--z-sticky)] grid h-auto w-full grid-cols-3 gap-1"
                            >
                                <TabsTrigger value="profile">Profile</TabsTrigger>
                                <TabsTrigger value="body">Body</TabsTrigger>
                                <TabsTrigger value="face">Face</TabsTrigger>
                                <TabsTrigger value="hair">Hair</TabsTrigger>
                                <TabsTrigger value="gear">Gear</TabsTrigger>
                                <TabsTrigger value="pose">Pose</TabsTrigger>
                            </TabsList>

                            <TabsContent value="profile" class="mt-0 grid gap-5 pt-4">
                                <div class="grid gap-2">
                                    <Label for="creator-name">Name <span class="text-destructive-strong">*</span></Label>
                                    <Input
                                        id="creator-name"
                                        v-model="name"
                                        :maxlength="NAME_MAX"
                                        placeholder="Nova Reyes"
                                        autocomplete="off"
                                        class="h-11"
                                        :disabled="saving"
                                    />
                                    <p class="text-xs text-muted-foreground">{{ name.length }}/{{ NAME_MAX }} characters</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label id="creator-position-label">Position <span class="text-destructive-strong">*</span></Label>
                                    <Select v-model="position" :disabled="saving">
                                        <SelectTrigger class="h-11" aria-labelledby="creator-position-label">
                                            <SelectValue placeholder="Select position..." />
                                        </SelectTrigger>
                                        <SelectContent class="bg-surface-raised border-2 shadow-xl" position="popper">
                                            <SelectItem v-for="pos in POSITIONS" :key="pos.value" :value="pos.value">
                                                {{ pos.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <div class="flex items-baseline justify-between">
                                        <Label id="creator-rating-label">Overall rating</Label>
                                        <span class="text-2xl font-bold tabular-nums text-primary-strong" aria-hidden="true">{{ overallRating }}</span>
                                    </div>
                                    <Slider
                                        :model-value="[overallRating]"
                                        :min="0"
                                        :max="99"
                                        :step="1"
                                        thumb-label="Overall rating"
                                        :disabled="saving"
                                        @update:model-value="setRating"
                                    />
                                    <p class="text-xs text-muted-foreground">0 (Poor) – 99 (Elite)</p>
                                </div>
                            </TabsContent>

                            <TabsContent value="body" class="mt-0 pt-4">
                                <CreatorBodyTab v-model:profile="profile" v-model:look="look" :disabled="saving" />
                            </TabsContent>

                            <TabsContent value="face" class="mt-0 grid gap-5 pt-4">
                                <div class="grid gap-2">
                                    <Label id="creator-facial-label">Facial hair</Label>
                                    <ToggleGroup
                                        type="single"
                                        variant="outline"
                                        class="flex flex-wrap justify-start gap-2"
                                        aria-labelledby="creator-facial-label"
                                        :model-value="look.facialHair.style"
                                        :disabled="saving"
                                        @update:model-value="chooseFacialHair"
                                    >
                                        <ToggleGroupItem v-for="style in facialStyles" :key="style" :value="style">
                                            {{ FACIAL_HAIR_LABELS[style] }}
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                    <p v-if="facialStyles.length === 1" class="text-xs text-muted-foreground">No facial hair fits this frame yet.</p>
                                </div>
                                <ColourField
                                    v-if="look.facialHair.style !== 'none'"
                                    :model-value="look.facialHair.color"
                                    label="Facial hair colour"
                                    :swatches="HAIR_SWATCHES"
                                    :disabled="saving"
                                    @update:model-value="(color) => (look = { ...look, facialHair: { ...look.facialHair, color } })"
                                />
                                <p class="text-xs text-muted-foreground">Eyebrows follow the hair colour.</p>
                            </TabsContent>

                            <TabsContent value="hair" class="mt-0 grid gap-5 pt-4">
                                <div class="grid gap-2">
                                    <Label id="creator-hair-label">Style</Label>
                                    <ToggleGroup
                                        type="single"
                                        variant="outline"
                                        class="flex flex-wrap justify-start gap-2"
                                        aria-labelledby="creator-hair-label"
                                        :model-value="look.hair.style"
                                        :disabled="saving"
                                        @update:model-value="chooseHair"
                                    >
                                        <ToggleGroupItem v-for="style in hairStyles" :key="style" :value="style">
                                            {{ HAIR_LABELS[style] }}
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                    <p class="text-xs text-muted-foreground">The styles that fit this frame's head.</p>
                                </div>
                                <ColourField
                                    :model-value="look.hair.color"
                                    label="Hair colour"
                                    :swatches="HAIR_SWATCHES"
                                    :disabled="saving"
                                    @update:model-value="(color) => (look = { ...look, hair: { ...look.hair, color } })"
                                />
                            </TabsContent>

                            <TabsContent value="gear" class="mt-0 grid gap-2 pt-4">
                                <Label for="creator-number">Jersey number</Label>
                                <Input
                                    id="creator-number"
                                    :model-value="numberDraft"
                                    inputmode="numeric"
                                    maxlength="2"
                                    autocomplete="off"
                                    class="h-11 w-24"
                                    :aria-invalid="numberInvalid ? 'true' : undefined"
                                    aria-describedby="creator-number-hint"
                                    :disabled="saving"
                                    @update:model-value="setNumber"
                                />
                                <p id="creator-number-hint" class="text-xs" :class="numberInvalid ? 'text-destructive-strong' : 'text-muted-foreground'">
                                    {{ numberInvalid ? '0-99, or 00' : 'Worn when the team gives this player no number.' }}
                                </p>
                            </TabsContent>

                            <TabsContent value="pose" class="mt-0 grid gap-2 pt-4">
                                <Label id="creator-pose-label">Pose</Label>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    class="grid grid-cols-2 gap-2"
                                    aria-labelledby="creator-pose-label"
                                    :model-value="look.pose"
                                    :disabled="saving"
                                    @update:model-value="choosePose"
                                >
                                    <ToggleGroupItem v-for="pose in POSES" :key="pose" :value="pose">
                                        {{ POSE_LABELS[pose] }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <DialogFooter class="flex-row justify-end gap-2 border-t border-border px-6 py-4 *:flex-1 @min-[32rem]:*:flex-none">
                    <Button type="button" variant="outline" :disabled="saving" @click="open = false">Cancel</Button>
                    <Button type="submit" :disabled="!isFormValid || saving">
                        {{ saving ? 'Saving…' : isEditMode ? 'Save player' : 'Create player' }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
/* The pinned stack's height, shared by the preview, the tab list under it
   and the scroller's padding: Shift+Tab then scrolls a control to just below
   the stack (preview + its 1.5rem padding + the tab list), not behind it. */
.creator-scroller {
    --creator-preview-h: min(42dvh, 22rem);
    scroll-padding-top: calc(var(--creator-preview-h) + 1.5rem + 5.5rem);
}

.creator-preview {
    height: var(--creator-preview-h);
}

.creator-tabs {
    top: calc(var(--creator-preview-h) + 1.5rem);
}

/* Side by side: the preview is taller and nothing sits above the tabs.
   Here, not as Tailwind variants: scoped rules outrank utilities. */
@container (min-width: 44rem) {
    .creator-scroller {
        scroll-padding-top: 0;
    }

    .creator-preview {
        height: min(70dvh, 36rem);
    }

    /* Level with the preview, and already at its sticky offset, so the
       pinned tab list never slides over the panel below it. */
    .creator-tabs-column {
        padding-top: 1rem;
    }

    .creator-tabs {
        top: 1rem;
    }
}
</style>
