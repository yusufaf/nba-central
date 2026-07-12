<script setup lang="ts">
import { nextTick, onMounted, ref, watchEffect } from 'vue';
import jerseyImg from '@/assets/basketball_jersey.png';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Flag, Paperclip } from 'lucide-vue-next';
import HistoricalTeamCombobox from './HistoricalTeamCombobox.vue';

interface HistoricalTeam {
    name: string;
    city: string;
    country: string;
}

const props = defineProps<{
    nbaTeamLogos: any[];
}>();

const showTeamCustomizationDialog = defineModel<boolean>(
    'showTeamCustomizationDialog',
);
const teamDescription = defineModel<string>('teamDescription');
const teamCity = defineModel<string>('teamCity');
const teamCountry = defineModel<string>('teamCountry');
const teamLogo = defineModel<string>('teamLogo');
const selectedFile = ref<File | null>(null);

/* Canvas Props */
const drawingCanvas = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref<boolean>(false);
const context = ref<any>(null);
const currentX = ref<number>(0);
const currentY = ref<number>(0);

const canvasWidth = 500;
const canvasHeight = 500;

const handleLogoClick = (value: any) => {
    teamLogo.value = value;
};

const handleHistoricalTeamSelect = (team: HistoricalTeam) => {
    teamCity.value = team.city;
    teamCountry.value = team.country;
};

const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        selectedFile.value = target.files[0];
    }
};

const startDrawing = (e: any) => {
    isDrawing.value = true;
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
        '2d',
    ) as CanvasRenderingContext2D;

    localContext.fillStyle = 'white';
    localContext.fillRect(0, 0, canvasWidth, canvasHeight);

    const img = new Image();
    img.onload = () => {
        localContext.drawImage(img, 0, 0);
    };
    img.src = jerseyImg;

    context.value = localContext;
};

onMounted(() => {
    nextTick(() => {
        watchEffect(() => {
            setupCanvas();
        });
    });
});
</script>

<template>
    <Dialog v-model:open="showTeamCustomizationDialog">
        <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Team Customization</DialogTitle>
            </DialogHeader>

            <div class="space-y-8">
                <!-- Team Description -->
                <div class="space-y-2 pb-4">
                    <Label for="team-description" class="text-base font-semibold text-foreground">Team Description</Label>
                    <textarea
                        id="team-description"
                        v-model="teamDescription"
                        class="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:!border-primary focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter team description..."
                    />
                </div>

                <!-- Historical Team -->
                <div class="space-y-2 pb-4">
                    <Label class="text-base font-semibold text-foreground">Base on a Historical Team</Label>
                    <HistoricalTeamCombobox @select="handleHistoricalTeamSelect" />
                    <p class="text-xs text-muted-foreground">
                        Picking a team fills in City and Country below — feel free to edit them afterward.
                    </p>
                </div>

                <!-- City -->
                <div class="space-y-2 pb-4">
                    <Label for="team-city" class="text-base font-semibold text-foreground">City</Label>
                    <div class="relative">
                        <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="team-city"
                            v-model="teamCity"
                            placeholder="Enter city..."
                            class="pl-10"
                        />
                    </div>
                </div>

                <!-- Country -->
                <div class="space-y-2 pb-4">
                    <Label for="team-country" class="text-base font-semibold text-foreground">Country</Label>
                    <div class="relative">
                        <Flag class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="team-country"
                            v-model="teamCountry"
                            placeholder="Enter country..."
                            class="pl-10"
                        />
                    </div>
                </div>

                <!-- Team Logo Upload -->
                <div class="space-y-2 pb-4">
                    <Label for="team-logo-upload" class="text-base font-semibold text-foreground">Team Logo</Label>
                    <div class="relative">
                        <Paperclip class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <input
                            id="team-logo-upload"
                            type="file"
                            accept="image/*,.jpg,.png"
                            @change="handleFileChange"
                            class="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus:!border-primary focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                </div>

                <!-- Existing Team Logos -->
                <div class="space-y-2 pb-4">
                    <Label class="text-base font-semibold text-foreground">Or select an existing team's logo:</Label>
                    <div class="team-logos">
                        <template v-for="logo in props.nbaTeamLogos" :key="logo.href">
                            <img
                                :src="logo.href"
                                :alt="logo.alt || 'Team logo'"
                                class="team-logo"
                                :class="{ selected: logo.href === teamLogo }"
                                @click="() => handleLogoClick(logo.href)"
                            />
                        </template>
                    </div>
                </div>

                <!-- Team Jersey Canvas -->
                <div class="space-y-2">
                    <Label class="text-base font-semibold text-foreground">Team Jersey</Label>
                    <div class="canvas-container">
                        <canvas
                            ref="drawingCanvas"
                            :width="canvasWidth"
                            :height="canvasHeight"
                            @mousedown="startDrawing"
                            @mousemove="draw"
                            @mouseup="stopDrawing"
                            class="border border-border rounded-md"
                        />
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
/* Force orange focus borders for inputs and textareas */
input:focus,
input:focus-visible,
textarea:focus,
textarea:focus-visible {
    border-color: hsl(var(--primary)) !important;
    box-shadow: none !important;
    outline: none !important;
}

.team-logos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.25rem, 1fr));
    gap: 0.75rem;
}

.team-logo {
    border: 0.125rem solid hsl(var(--border));
    border-radius: 0.5rem;
    cursor: pointer;
    height: 6.25rem;
    width: 6.25rem;
    object-fit: contain;
    transition: border-color 0.2s;
}

.team-logo:hover {
    border-color: hsl(var(--primary));
}

.team-logo.selected {
    border: 0.25rem solid hsl(var(--primary));
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
}

.canvas-container {
    width: 100%;
    max-width: 31.25rem;
    aspect-ratio: 1 / 1;
    overflow: hidden;
}

.canvas-container canvas {
    width: 100%;
    height: 100%;
    display: block;
}
</style>
