<script setup lang="ts" generic="Look extends PersonAppearance | StaffAppearance">
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { POSES, type PersonAppearance, type PoseId, type StaffAppearance } from '@/constants/appearance';
import { POSE_LABELS } from '@/utils/appearanceOptions';

const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });
const look = defineModel<Look>('look', { required: true });

// A clear (clicking the selected toggle again) is ignored: the field is required.
const choosePose = (pose: unknown) => {
    if (!pose) return;
    look.value = { ...look.value, pose: pose as PoseId };
};
</script>

<template>
    <div class="grid gap-2">
        <Label id="creator-pose-label">Pose</Label>
        <ToggleGroup
            type="single"
            variant="outline"
            class="grid grid-cols-2 gap-2"
            aria-labelledby="creator-pose-label"
            :model-value="look.pose"
            :disabled="props.disabled"
            @update:model-value="choosePose"
        >
            <ToggleGroupItem v-for="pose in POSES" :key="pose" :value="pose">
                {{ POSE_LABELS[pose] }}
            </ToggleGroupItem>
        </ToggleGroup>
    </div>
</template>
