<script setup lang="ts">
import { ref, watch, onMounted, computed, nextTick, watchEffect } from "vue";
import {
    VIEW_OPTIONS,
    DRAWER_OPTIONS,
    ESPN_TEAM_URL,
} from "@/constants/constants";
import axios from "axios";
import jerseyImg from "@/assets/basketbalL_jersey.png";

const props = defineProps<{
    headerExpanded: boolean;
    teamName: string;
    teamDescription: string;
    teamCity: string;
    teamCountry: string;
    teamLogo: string;
    drawerSide: any;
    selectedView: string;
}>();

const emit = defineEmits([
    "reset",
    "saveTeam",
    "update:headerExpanded",
    "update:teamName",
    "update:teamDescription",
    "update:teamCity",
    "update:teamCountry",
    "update:teamLogo",
    "update:drawerSide",
    "update:selectedView",
]);

/* 2-Way Bound Props */
const localTeamName = computed({
    get() {
        return props.teamName;
    },
    set(value) {
        emit("update:teamName", value);
    },
});

const localTeamDescription = computed({
    get() {
        return props.teamDescription;
    },
    set(value) {
        emit("update:teamDescription", value);
    },
});

const localTeamCity = computed({
    get() {
        return props.teamCity;
    },
    set(value) {
        emit("update:teamCity", value);
    },
});

const localTeamCountry = computed({
    get() {
        return props.teamCountry;
    },
    set(value) {
        emit("update:teamCountry", value);
    },
});

const localTeamLogo = computed({
    get() {
        return props.teamLogo;
    },
    set(value) {
        emit("update:teamLogo", value);
    },
});

const localDrawerSide = ref<any>(props.drawerSide);
const localSelectedView = ref<string>(props.selectedView);
const localHeaderExpanded = ref<boolean>(false);

const showConfirm = ref<boolean>(false);
const showTeamCustomizationDialog = ref<boolean>(false);
const selectedFile = ref<null>(null);

const nbaTeamLogos = ref<any[]>([]);

/* Canvas Props */
const drawingCanvas = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref<boolean>(false);
const context = ref<any>(null);
const currentX = ref<number>(0);
const currentY = ref<number>(0);

const canvasWidth = 500;
const canvasHeight = 500;

/* Watchers */
watch(localDrawerSide, (newDrawerSide) => {
    emit("update:drawerSide", newDrawerSide);
});

watch(localSelectedView, (newSelectedView) => {
    emit("update:selectedView", newSelectedView);
});

watch(localHeaderExpanded, (newHeaderExpanded) => {
    emit("update:headerExpanded", newHeaderExpanded);
});

const resetClick = () => {
    showConfirm.value = !showConfirm.value;
};

const resetConfirm = () => {
    emit("reset");
};

const saveClick = () => {
    emit("saveTeam");
};

const expandClick = () => {
    localHeaderExpanded.value = !localHeaderExpanded.value;
};

const toggleCustomizationDialog = () => {
    showTeamCustomizationDialog.value = !showTeamCustomizationDialog.value;
};

const fetchAllTeamLogos = async () => {
    const tempLogos = [];
    for (let i = 1; i < 31; i++) {
        const url = `${ESPN_TEAM_URL}${i}`;
        const response = await axios.get(url);
        const { team } = response.data;

        const logos = team.logos;

        /* Take the first logo for now */
        const logo = logos[0];
        tempLogos.push(logo);
    }

    /* Sort the logos alphabetically */
    nbaTeamLogos.value = tempLogos.sort((a, b) => {
        const hrefSplitA = a.href.split("/");
        const teamAbbrA = a.href.split("/")[hrefSplitA.length - 1];

        const hrefSplitB = b.href.split("/");
        const teamAbbrB = b.href.split("/")[hrefSplitB.length - 1];

        return teamAbbrA.localeCompare(teamAbbrB);
    });
};

// For the q-file component:         @update:model-value="onUpdateFile"
// const onUpdateFile = (value: any) => {
//   const uploadDate = new Date().toLocaleDateString();
//   const reader = new FileReader();
//   reader.onload = () => {
//     console.log("Result of FileReader = ", reader.result);
//   }
//   reader.readAsDataURL(value);

//   console.log(value);
// }

const handleLogoClick = (value: any) => {
    localTeamLogo.value = value;
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
        "2d"
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
    fetchAllTeamLogos();
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
    <div class="header" :class="{ expanded: localHeaderExpanded }">
        <div class="header-top">
            <div class="title-input-container">
                <q-input
                    class="title-input"
                    v-model="localTeamName"
                    label="Team Name"
                    stack-label
                    dark
                />
                <q-btn
                    @click="toggleCustomizationDialog"
                    round
                    icon="edit"
                    title="Open customization dialog"
                />
            </div>

            <div class="hidden">Hidden</div>
            <!-- TODO: Make the score animated so that when its value changes there's some cool animation  -->
            <div class="score">Score: N/A</div>
            <div class="team-builder-buttons">
                <q-btn
                    class="expand-btn"
                    @click="expandClick"
                    round
                    :icon="localHeaderExpanded ? 'expand_less' : 'expand_more'"
                    title="More"
                />
                <q-btn round icon="more_vert" title="More">
                    <q-menu
                        dark
                        transition-show="jump-down"
                        transition-hide="jump-up"
                    >
                        <q-list dark>
                            <q-item>
                                <q-item-section side>
                                    <q-item-label>Drawer Side</q-item-label>
                                </q-item-section>
                                <q-item-section>
                                    <q-btn-toggle
                                        v-model="localDrawerSide"
                                        toggle-color="primary"
                                        :options="DRAWER_OPTIONS"
                                    />
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
                <q-btn-toggle
                    v-model="localSelectedView"
                    toggle-color="primary"
                    :options="VIEW_OPTIONS"
                />
                <q-btn
                    @click="resetClick"
                    round
                    color="black"
                    icon="share"
                    title="Share"
                />
                <q-btn
                    @click="resetClick"
                    round
                    color="black"
                    icon="refresh"
                    title="Reset"
                />
                <q-btn
                    @click="saveClick"
                    round
                    color="black"
                    icon="save"
                    title="Save"
                />
            </div>
            <q-dialog v-model="showConfirm">
                <q-card dark>
                    <q-card-section class="row items-center">
                        <div>
                            Are you sure you want to reset your whole team?
                        </div>
                    </q-card-section>
                    <q-card-actions align="right">
                        <q-btn
                            flat
                            label="Cancel"
                            color="primary"
                            v-close-popup
                        />
                        <q-btn
                            @click="resetConfirm"
                            label="Confirm"
                            color="primary"
                            v-close-popup
                        />
                    </q-card-actions>
                </q-card>
            </q-dialog>
        </div>
    </div>
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

<style scoped>
.header {
    display: flex;
    flex-direction: column;
    border-bottom: 0.125rem solid var(--vt-c-divider-dark-1);
}

.header-top {
    display: flex;
    flex-direction: row;
    align-items: center;
}

.header.expanded {
    height: 10rem;
}

.team-builder-buttons {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin-left: auto;
}

.title-input-container {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.title-input {
    margin-left: 2rem;
    width: 20rem;
}

.desc-input {
    resize: none;
}

.hidden {
    visibility: hidden;
}

.score {
    display: flex;
    font-size: 2rem;
    font-weight: 600;
    margin-left: auto;
    /* justify-self: center; */
}

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
