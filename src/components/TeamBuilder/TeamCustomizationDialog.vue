<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
    hideScores: boolean;
    useShortNames: boolean;
    hideFinishedGames: boolean;
}>();

const emit = defineEmits([
    "update:hideScores",
    "update:useShortNames",
    "update:hideFinishedGames",
]);

const localHideScores = computed({
    get() {
        return props.hideScores;
    },
    set(value) {
        emit("update:hideScores", value);
    },
});

const localUseShortNames = computed({
    get() {
        return props.useShortNames;
    },
    set(value) {
        emit("update:useShortNames", value);
    },
});

const localHideFinishedGames = computed({
    get() {
        return props.hideFinishedGames;
    },
    set(value) {
        emit("update:hideFinishedGames", value);
    },
});
</script>

<template>
    <q-dialog v-model="showTeamCustomizationDialog">
        <div class="customization-dialog">
            <div class="customization-header">
                <div class="customization-title">Team Customization</div>
                <q-btn
                    @click="toggleCustomizationDialog"
                    round
                    icon="close"
                    title="Close customization dialog"
                />
            </div>
            <q-input
                v-model="localTeamDescription"
                outlined
                label="Team Description"
                stack-label
                dark
                type="textarea"
                class="desc-input"
            />
            <q-input v-model="localTeamCity" label="City" dark>
                <template v-slot:prepend>
                    <q-icon name="place" />
                </template>
            </q-input>
            <q-input v-model="localTeamCountry" label="Country" dark>
                <template v-slot:prepend>
                    <q-icon name="flag" />
                </template>
            </q-input>
            <div>Team Logo</div>
            <q-file
                input-class="file-picker"
                dark
                outlined
                v-model="selectedFile"
                label="Click to select files or drag into this area"
                stack-label
                accept=".jpg, image/*"
            >
                <template v-slot:prepend>
                    <q-icon name="attach_file" />
                </template>
            </q-file>
            <div>or select an existing team's logo:</div>
            <div class="team-logos">
                <q-img
                    v-for="logo in nbaTeamLogos"
                    :key="logo.href"
                    :src="logo.href"
                    class="team-logo"
                    :class="{ selected: logo.href === localTeamLogo }"
                    @click="() => handleLogoClick(logo.href)"
                />
            </div>
            <div>Team Jersey</div>
            <canvas
                ref="drawingCanvas"
                :style="{
                    height: `${canvasHeight}px`,
                    width: `${canvasWidth}px`,
                }"
                @mousedown="startDrawing"
                @mousemove="draw"
                @mouseup="stopDrawing"
            />
        </div>
    </q-dialog>
</template>
