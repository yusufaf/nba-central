<script setup lang="ts">
// "View in 3D" from the builder (#288): the 3D scene of the team as it is
// being edited, in a sheet over the builder, so nothing in the builder moves.
// The scene mounts only while the sheet is open, and closing it unmounts and
// disposes it. DialogTrigger is what returns focus to the button on close.
import { computed, ref, watch } from 'vue';
import { Box } from 'lucide-vue-next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CourtDesign } from '@/models/api';
import { Scene3DUnavailable, TeamScene3DAsync } from '@/components/scene3d';
import { sceneLabel, type ScenePerson } from '@/components/scene3d/people';
import { isWebGLAvailable } from '@/utils/webgl';
import { track } from '@/lib/analytics';

const props = defineProps<{
    court: CourtDesign | null;
    logoUrl?: string;
    drawingUrl?: string;
    capacity: number | null;
    people: ScenePerson[];
    jerseyUrl?: string;
    teamName: string;
}>();

const open = ref(false);
// Probed on the first open only: the probe costs a GPU context.
const webgl = ref<boolean | null>(null);
let noWebglTracked = false;
const label = computed(() => sceneLabel(props.teamName, props.people));

watch(open, (now) => {
    if (!now) return;
    track('scene3d_view_clicked', { on: true, page: 'builder' });
    webgl.value ??= isWebGLAvailable();
    if (webgl.value) track('scene3d_opened', { page: 'builder' });
    else if (!noWebglTracked) {
        noWebglTracked = true;
        track('scene3d_failed', { reason: 'no-webgl' });
    }
});
</script>

<template>
    <Dialog v-model:open="open">
        <DialogTrigger as-child>
            <Button data-testid="view-3d-button" variant="outline" size="sm"><Box class="mr-2 h-4 w-4" aria-hidden="true" />View in 3D</Button>
        </DialogTrigger>
        <DialogContent size="sheet">
            <DialogHeader class="px-6 pt-6 pr-16 text-left">
                <DialogTitle>{{ teamName.trim() || 'Your team' }} in 3D</DialogTitle>
                <DialogDescription>Includes your unsaved changes.</DialogDescription>
            </DialogHeader>
            <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 @min-[32rem]:px-6 @min-[32rem]:pb-6">
                <TeamScene3DAsync
                    v-if="webgl"
                    :court="court"
                    :logo-url="logoUrl"
                    :drawing-url="drawingUrl"
                    :capacity="capacity"
                    :label="label"
                    :people="people"
                    :jersey-url="jerseyUrl"
                    :team-name="teamName"
                />
                <Scene3DUnavailable v-else reason="no-webgl" />
            </div>
        </DialogContent>
    </Dialog>
</template>
