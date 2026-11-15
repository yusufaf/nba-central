<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { previewPerson } from '@/components/scene3d/people';
import type { PersonAppearance } from '@/constants/appearance';
import { track } from '@/lib/analytics';
import type { Player, PlayerPosition } from '@/models/types';
import { DEFAULT_APPEARANCE, parseAppearance } from '@/utils/appearance';
import { appearanceLabel, forFrame, shownAccessories, type BodyProfile } from '@/utils/appearanceOptions';
import { isJerseyNumber } from '@/utils/rosterNumbers';
import { isWebGLAvailable } from '@/utils/webgl';
import CreatorAccessories from './CreatorAccessories.vue';
import CreatorBodyTab from './CreatorBodyTab.vue';
import CreatorFaceTab from './CreatorFaceTab.vue';
import CreatorHairTab from './CreatorHairTab.vue';
import CreatorPoseTab from './CreatorPoseTab.vue';
import CreatorSheet from './CreatorSheet.vue';
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
const TABS = [
    { value: 'profile', label: 'Profile' },
    { value: 'body', label: 'Body' },
    { value: 'face', label: 'Face' },
    { value: 'hair', label: 'Hair' },
    { value: 'gear', label: 'Gear' },
    { value: 'pose', label: 'Pose' },
] as const;

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
    // A hand-made look can carry a cut that doesn't fit its frame, or both
    // goggles and glasses: map them, so the tabs show what the preview shows.
    const stored = parseAppearance(player?.appearance);
    const framed = stored && forFrame(stored, stored.frame);
    look.value = framed ? { ...framed, accessories: shownAccessories(framed.accessories) } : structuredClone(DEFAULT_APPEARANCE);
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
    <CreatorSheet
        v-model:open="open"
        v-model:tab="tab"
        :title="isEditMode ? 'Edit player' : 'Create player'"
        :submit-label="isEditMode ? 'Save player' : 'Create player'"
        :saving="saving"
        :valid="isFormValid"
        :person="preview"
        :label="previewLabel"
        :webgl="webgl"
        :tabs="TABS"
        @submit="submit"
    >
        <template #profile>
            <div class="grid gap-5">
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
            </div>
        </template>

        <template #body>
            <CreatorBodyTab v-model:profile="profile" v-model:look="look" :disabled="saving" />
        </template>

        <template v-slot:face>
            <CreatorFaceTab v-model:look="look" :disabled="saving" />
        </template>

        <template #hair>
            <CreatorHairTab v-model:look="look" :disabled="saving" />
        </template>

        <template #gear>
            <div class="grid gap-5">
                <div class="grid gap-2">
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
                </div>
                <CreatorAccessories
                    :model-value="look.accessories"
                    :disabled="saving"
                    @update:model-value="(accessories) => (look = { ...look, accessories })"
                />
            </div>
        </template>

        <template #pose>
            <CreatorPoseTab v-model:look="look" :disabled="saving" />
        </template>
    </CreatorSheet>
</template>

