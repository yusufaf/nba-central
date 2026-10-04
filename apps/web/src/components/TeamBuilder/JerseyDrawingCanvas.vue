<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import DrawingCanvas from "@/components/drawing/DrawingCanvas.vue";
import jerseyTemplate from "@/assets/basketball_jersey.png";
import { useDrawing } from "@/composables/useDrawing";

// Matches basketball_jersey.png's natural size - fixed rather than read at
// runtime so the canvas has its final resolution on first paint instead of
// resizing once the template image loads.
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 1253;

// A saved team caps out well under DynamoDB's 400KB item limit even with a
// full roster, so this is a generous ceiling meant to catch a pathological
// drawing, not a normal one.
const MAX_JERSEY_DATA_URL_BYTES = 200 * 1024;

const teamJersey = defineModel<string>("teamJersey");

// The template is captured once on mount, not reactive to teamJersey
// afterward - this component is the only writer of teamJersey while it's
// active, and if the template tracked every commit, the *next* commit
// would flatten a template that already has earlier strokes baked in
// underneath a canvas that replays every stroke again, doubling them up.
// isEditingSavedDrawing starts from that same mount-time check but is a
// ref, since startOver() needs to turn it back off once the saved drawing
// it referred to is gone.
const initialJersey = teamJersey.value ?? "";
const isEditingSavedDrawing = ref(initialJersey.startsWith("data:"));
const template = ref<string>(isEditingSavedDrawing.value ? initialJersey : jerseyTemplate);

// The jersey is stored inline on the team as a data: URL, so its strokes
// only need to last while this tab is open: a remount starts from the
// flattened result instead.
const drawing = useDrawing();
const surface = ref<InstanceType<typeof DrawingCanvas> | null>(null);

const onCommit = (dataUrl: string | null) => {
    if (dataUrl) teamJersey.value = dataUrl;
};

const startOver = () => {
    drawing.clear();
    template.value = jerseyTemplate;
    isEditingSavedDrawing.value = false;
    teamJersey.value = "";
    surface.value?.resetError();
};
</script>

<template>
    <DrawingCanvas
        ref="surface"
        :drawing="drawing"
        :width="CANVAS_WIDTH"
        :height="CANVAS_HEIGHT"
        :template="template"
        :max-bytes="MAX_JERSEY_DATA_URL_BYTES"
        :editing-saved="isEditingSavedDrawing"
        max-width="20rem"
        label="Jersey drawing"
        template-error-message="Couldn't load the jersey background, so drawing can't be saved right now - try reopening this dialog."
        @commit="onCommit"
    >
        <template #actions>
            <Button
                v-if="isEditingSavedDrawing || !drawing.isEmpty.value"
                type="button"
                variant="ghost"
                size="sm"
                @click="startOver"
            >
                Start over
            </Button>
        </template>
    </DrawingCanvas>
</template>
