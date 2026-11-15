<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import nbaTeamsData from '@/assets/data/nbaTeams.json';
import { previewStaff } from '@/components/scene3d/people';
import { STAFF_HEIGHT_INCHES, type StaffAppearance } from '@/constants/appearance';
import { track } from '@/lib/analytics';
import type { Coach, CoachSpecialty, GM, NBATeam } from '@/models/types';
import { DEFAULT_STAFF_APPEARANCE, parseStaffAppearance } from '@/utils/appearance';
import { forFrame, staffAppearanceLabel } from '@/utils/appearanceOptions';
import { isWebGLAvailable } from '@/utils/webgl';
import CreatorFaceTab from './CreatorFaceTab.vue';
import CreatorHairTab from './CreatorHairTab.vue';
import CreatorOutfitTab from './CreatorOutfitTab.vue';
import CreatorPoseTab from './CreatorPoseTab.vue';
import CreatorSheet from './CreatorSheet.vue';
import CreatorStaffBodyTab from './CreatorStaffBodyTab.vue';
import type { CustomCoachPayload, CustomGMPayload, StaffHeight } from './types';

// The creator in staff mode (#294): a custom coach's or GM's profile plus
// their look. Real coaches and GMs never come here; they stay figurines.
const props = withDefaults(
    defineProps<{ kind: 'coach' | 'gm'; editing?: Coach | GM | null; saving?: boolean }>(),
    { editing: null, saving: false },
);
const emit = defineEmits<{ submit: [data: CustomCoachPayload | CustomGMPayload] }>();
const open = defineModel<boolean>('open', { default: false });

const NAME_MAX = 100;
const TABS = [
    { value: 'profile', label: 'Profile' },
    { value: 'body', label: 'Body' },
    { value: 'face', label: 'Face' },
    { value: 'hair', label: 'Hair' },
    { value: 'outfit', label: 'Outfit' },
    { value: 'pose', label: 'Pose' },
] as const;
const SPECIALTIES: { value: CoachSpecialty; label: string }[] = [
    { value: 'Offensive', label: 'Offensive Minded' },
    { value: 'Defensive', label: 'Defensive Minded' },
    { value: 'Balanced', label: 'Balanced' },
];
const nbaTeams = nbaTeamsData as NBATeam[];

const name = ref('');
const overallRating = ref(75);
const specialty = ref<CoachSpecialty>('Balanced');
const teams = ref<string[]>([]);
const look = ref<StaffAppearance>(structuredClone(DEFAULT_STAFF_APPEARANCE));
const height = ref<StaffHeight>({ feet: 6, inches: 2 });
const tab = ref('profile');
const webgl = ref(true);

const isEditMode = computed(() => !!props.editing);
const noun = computed(() => (props.kind === 'coach' ? 'coach' : 'GM'));

const toDraft = (inches: number): StaffHeight => ({ feet: Math.floor(inches / 12), inches: inches % 12 });

const seed = () => {
    const entity = props.editing;
    name.value = entity?.name ?? '';
    const coach = props.kind === 'coach' ? (entity as Coach | null) : null;
    overallRating.value = coach?.overallRating ?? 75;
    specialty.value = coach?.specialty ?? 'Balanced';
    teams.value = props.kind === 'gm' ? [...((entity as GM | null)?.teams ?? [])] : [];
    // A coach or GM saved before looks existed starts from the default one.
    const stored = parseStaffAppearance(entity?.appearance);
    look.value = stored ? forFrame(stored, stored.frame) : structuredClone(DEFAULT_STAFF_APPEARANCE);
    height.value = toDraft(look.value.build.heightIn);
    tab.value = 'profile';
};

watch(
    open,
    (isOpen) => {
        if (!isOpen) return;
        seed();
        webgl.value = isWebGLAvailable();
        track('creator_opened', { kind: props.kind, mode: isEditMode.value ? 'edit' : 'create' });
    },
    { immediate: true },
);
watch(
    () => props.editing,
    () => {
        if (open.value) seed();
    },
);

const heightInches = computed(() => height.value.feet * 12 + height.value.inches);
const heightValid = computed(
    () =>
        Number.isInteger(height.value.feet) &&
        Number.isInteger(height.value.inches) &&
        height.value.inches >= 0 &&
        height.value.inches <= 11 &&
        heightInches.value >= STAFF_HEIGHT_INCHES.min &&
        heightInches.value <= STAFF_HEIGHT_INCHES.max,
);
// The look follows the draft only while it's in range, so the preview never
// takes a half-typed height.
watch(heightInches, (inches) => {
    if (heightValid.value && inches !== look.value.build.heightIn) {
        look.value = { ...look.value, build: { ...look.value.build, heightIn: inches } };
    }
});

// The name never reaches the preview, so typing it doesn't rebuild the figure.
const preview = computed(() => previewStaff(props.kind, look.value));
const previewLabel = computed(() => staffAppearanceLabel(name.value.trim() || `your ${noun.value}`, look.value));

const isFormValid = computed(() => {
    const trimmed = name.value.trim();
    const rating = overallRating.value;
    return (
        trimmed.length > 0 &&
        trimmed.length <= NAME_MAX &&
        heightValid.value &&
        (props.kind !== 'coach' || (Number.isInteger(rating) && rating >= 0 && rating <= 99))
    );
});

const setRating = (value: number[] | undefined) => {
    if (value) overallRating.value = Math.round(value[0]);
};
const availableTeams = computed(() => nbaTeams.filter((team) => !teams.value.includes(team.abbr)));
const addTeam = (abbr: unknown) => {
    if (typeof abbr === 'string' && abbr && !teams.value.includes(abbr)) teams.value = [...teams.value, abbr];
};
const removeTeam = (abbr: string) => {
    teams.value = teams.value.filter((team) => team !== abbr);
};

const hairHint = computed(() => (look.value.ageLook === 'young' ? null : 'Age look greys this colour in 3D.'));

const submit = () => {
    if (!isFormValid.value || props.saving) return;
    // A plain copy: the look holds reactive proxies, which structuredClone refuses.
    const appearance = JSON.parse(JSON.stringify(look.value)) as StaffAppearance;
    const trimmed = name.value.trim();
    emit(
        'submit',
        props.kind === 'coach'
            ? { name: trimmed, overallRating: overallRating.value, specialty: specialty.value, appearance }
            : { name: trimmed, teams: [...teams.value], appearance },
    );
};
</script>

<template>
    <CreatorSheet
        v-model:open="open"
        v-model:tab="tab"
        :title="isEditMode ? `Edit ${noun}` : `Create ${noun}`"
        :submit-label="isEditMode ? `Save ${noun}` : `Create ${noun}`"
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
                        :placeholder="kind === 'coach' ? 'Coach Vega' : 'Exec Ortiz'"
                        autocomplete="off"
                        class="h-11"
                        :disabled="saving"
                    />
                    <p class="text-xs text-muted-foreground">{{ name.length }}/{{ NAME_MAX }} characters</p>
                </div>

                <template v-if="kind === 'coach'">
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
                    <div class="grid gap-2">
                        <Label id="creator-specialty-label">Coaching specialty <span class="text-destructive-strong">*</span></Label>
                        <Select v-model="specialty" :disabled="saving">
                            <SelectTrigger class="h-11" aria-labelledby="creator-specialty-label">
                                <SelectValue placeholder="Select specialty..." />
                            </SelectTrigger>
                            <SelectContent class="bg-surface-raised border-2 shadow-xl" position="popper">
                                <SelectItem v-for="item in SPECIALTIES" :key="item.value" :value="item.value">
                                    {{ item.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </template>

                <div v-else class="grid gap-2">
                    <Label id="creator-teams-label">Teams (optional)</Label>
                    <div
                        v-if="teams.length"
                        class="flex min-h-12 flex-wrap gap-2 rounded-lg border bg-muted/50 p-3"
                        aria-labelledby="creator-teams-label"
                        role="list"
                    >
                        <Badge v-for="abbr in teams" :key="abbr" variant="secondary" class="flex items-center gap-1 px-2 py-1" role="listitem">
                            {{ abbr }}
                            <button
                                type="button"
                                class="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                                :aria-label="`Remove ${abbr}`"
                                :disabled="saving"
                                @click="removeTeam(abbr)"
                            >
                                <X class="h-3 w-3" />
                            </button>
                        </Badge>
                    </div>
                    <p v-else class="rounded-lg border bg-muted/50 p-3 text-center text-sm text-muted-foreground">No teams selected</p>
                    <Select :disabled="saving || availableTeams.length === 0" @update:model-value="addTeam">
                        <SelectTrigger class="h-11" aria-label="Add a team">
                            <SelectValue placeholder="Add a team..." />
                        </SelectTrigger>
                        <SelectContent class="bg-surface-raised border-2 shadow-xl max-h-60" position="popper">
                            <SelectItem v-for="team in availableTeams" :key="team.abbr" :value="team.abbr">
                                {{ team.abbr }} - {{ team.name }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p class="text-xs text-muted-foreground">Teams this GM has managed ({{ teams.length }}/30 selected)</p>
                </div>
            </div>
        </template>

        <template #body>
            <CreatorStaffBodyTab v-model:look="look" v-model:height="height" :disabled="saving" />
        </template>

        <template v-slot:face>
            <CreatorFaceTab v-model:look="look" :disabled="saving" />
        </template>

        <template #hair>
            <CreatorHairTab v-model:look="look" :disabled="saving" :colour-hint="hairHint" />
        </template>

        <template #outfit>
            <CreatorOutfitTab v-model:look="look" :disabled="saving" />
        </template>

        <template #pose>
            <CreatorPoseTab v-model:look="look" :disabled="saving" />
        </template>
    </CreatorSheet>
</template>
