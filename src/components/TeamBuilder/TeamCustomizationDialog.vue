<script setup lang="ts">
import { nextTick, onMounted, ref, watchEffect } from "vue";
import jerseyImg from "@/assets/basketball_jersey.png";

const props = defineProps<{
    nbaTeamLogos: any[];
}>();

const showTeamCustomizationDialog = defineModel<boolean>(
    "showTeamCustomizationDialog",
);
const teamDescription = defineModel<string>("teamDescription");
const teamCity = defineModel<string>("teamCity");
const teamCountry = defineModel<string>("teamCountry");
const teamLogo = defineModel<string>("teamLogo");
const selectedFile = ref<null>(null);

/* Canvas Props */
const drawingCanvas = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref<boolean>(false);
const context = ref<any>(null);
const currentX = ref<number>(0);
const currentY = ref<number>(0);

const canvasWidth = 500;
const canvasHeight = 500;

const toggleCustomizationDialog = () => {
    showTeamCustomizationDialog.value = !showTeamCustomizationDialog.value;
};

const handleLogoClick = (value: any) => {
    teamLogo.value = value;
};

const startDrawing = (e: any) => {
    isDrawing.value = true;
    // lastX.value = e.offsetX;
    // lastY.value = e.offsetY;
};

const stopDrawing = (e: any) => {
    isDrawing.value = false;
};

const draw = (e: any) => {
    if (!isDrawing.value) {
        return;
    }
    context.value.beginPath();
    context.value.moveTo(currentX.value, currentY.value);
    context.value.lineTo(e.offsetX, e.offsetY);
    context.value.stroke();

    currentX.value = e.offsetX;
    currentY.value = e.offsetY;
};

const setupCanvas = () => {
    if (!drawingCanvas.value) return;
    const localContext = drawingCanvas.value.getContext(
        "2d",
    ) as CanvasRenderingContext2D;
    console.log({ context });

    localContext.fillStyle = "white";
    localContext.fillRect(0, 0, canvasWidth, canvasHeight);

    const img = new Image();
    img.onload = () => {
        localContext.drawImage(img, 0, 0);
    };
    img.src = jerseyImg;

    context.value = localContext;
};

onMounted(() => {
    // Wait for nextTick to ensure the canvas element is rendered
    nextTick(() => {
        // Use watchEffect to wait for the ref to be assigned to the canvas element
        watchEffect(() => {
            setupCanvas();
        });
    });
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
                v-model="teamDescription"
                outlined
                label="Team Description"
                stack-label
                dark
                type="textarea"
                class="desc-input"
            />
            <q-input v-model="teamCity" label="City" dark>
                <template v-slot:prepend>
                    <q-icon name="place" />
                </template>
            </q-input>
            <q-input v-model="teamCountry" label="Country" dark>
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
                    v-for="logo in props.nbaTeamLogos"
                    :key="logo.href"
                    :src="logo.href"
                    class="team-logo"
                    :class="{ selected: logo.href === teamLogo }"
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

<style>
.customization-dialog {
    background: var(--vt-c-black-soft);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 40rem;
    width: 40rem;
    padding: 1rem;
}

.customization-dialog::-webkit-scrollbar {
    display: none;
}

.customization-header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
}

.customization-title {
    font-size: 1.25rem;
    font-weight: 600;
}

.file-picker {
    height: 20rem;
}

.team-logo {
    border: 0.125rem solid var(--vt-c-divider-dark-1);
    border-radius: 0.5rem;
    cursor: pointer;
    height: 6.25rem;
    width: 6.25rem;
}

.team-logo:hover {
    border: 0.125rem solid var(--q-primary);
}

.team-logo.selected {
    border: 0.25rem solid var(--q-positive);
}
</style>
