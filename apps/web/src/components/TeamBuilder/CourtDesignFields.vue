<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import CourtFloor from '@/components/court/CourtFloor.vue';
import type { CourtDesign } from '@/models/api';
import {
    BASELINE_TEXT_MAX,
    COURT_WOODS,
    LINE_PRESETS,
    PAINT_SWATCHES,
    SIDELINE_TEXT_MAX,
    normaliseHex,
    type ApronMode,
    type CourtWood,
    type LinesMode,
} from '@/utils/court';

// The Court tab: a live preview beside (or, in a narrow dialog, pinned
// above) the seven settings. The dialog owns the apron and line modes,
// because the tab unmounts whenever Details is showing.
const props = defineProps<{
    // The centre logo the preview draws, already resolved.
    logoUrl?: string;
    // The uploaded logo, saved or newly chosen, for the Upload option.
    uploadedLogo: string | null;
    logoPreparing: boolean;
    logoError: string | null;
    logoMissing: boolean;
    disabled?: boolean;
}>();

const emit = defineEmits<{
    chooseLogo: [file: File | undefined];
    removeLogo: [];
}>();

const court = defineModel<CourtDesign>('court', { required: true });
const apronMode = defineModel<ApronMode>('apronMode', { required: true });
const linesMode = defineModel<LinesMode>('linesMode', { required: true });

const update = (patch: Partial<CourtDesign>) => {
    court.value = { ...court.value, ...patch };
};

const woods = Object.entries(COURT_WOODS) as [CourtWood, (typeof COURT_WOODS)[CourtWood]][];

const isCustomPaint = computed(
    () => court.value.paint !== null && !PAINT_SWATCHES.some((swatch) => swatch.value === court.value.paint),
);

const setPaint = (paint: string | null) => {
    update(apronMode.value === 'match' ? { paint, apron: paint ?? null } : { paint });
    // Unpainted has nothing to match, so the apron falls back to stained wood.
    if (paint === null && apronMode.value === 'match') apronMode.value = 'stained';
};

const setApronMode = (mode: ApronMode | undefined) => {
    if (!mode) return;
    apronMode.value = mode;
    if (mode === 'match') update({ apron: court.value.paint });
    if (mode === 'stained') update({ apron: null });
    if (mode === 'custom') update({ apron: court.value.apron ?? court.value.paint ?? PAINT_SWATCHES[0].value });
};

const setLinesMode = (mode: LinesMode | undefined) => {
    if (!mode) return;
    linesMode.value = mode;
    if (mode !== 'custom') update({ lines: mode });
};

// The colour picker's hex field takes what's typed; keep only #rrggbb.
const withHex = (value: string, apply: (hex: string) => void) => {
    const hex = normaliseHex(value);
    if (hex) apply(hex);
};

const onLogoInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    emit('chooseLogo', input.files?.[0]);
    input.value = '';
};
</script>

<template>
    <div class="grid gap-6 @min-[44rem]:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] @min-[44rem]:items-start">
        <!-- Pinned while the settings scroll: above them in a narrow dialog,
             beside them in a wide one. -->
        <div class="sticky top-0 z-[var(--z-sticky)] -mx-6 -mt-4 bg-card px-6 pb-3 pt-4 @min-[44rem]:mx-0 @min-[44rem]:px-0">
            <div class="aspect-[104/58] overflow-hidden rounded-lg shadow-md" data-testid="court-preview">
                <CourtFloor :court="court" :logo-url="logoUrl" label="Court preview" />
            </div>
        </div>

        <div class="grid gap-5">
            <div class="grid gap-2">
                <Label id="court-floor-label">Floor</Label>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    class="flex flex-wrap justify-start gap-2"
                    aria-labelledby="court-floor-label"
                    :model-value="court.wood"
                    :disabled="disabled"
                    @update:model-value="(wood) => wood && update({ wood: wood as CourtWood })"
                >
                    <ToggleGroupItem v-for="[wood, preset] in woods" :key="wood" :value="wood" size="sm" class="gap-2">
                        <span class="court-chip" :style="{ backgroundColor: preset.base }" aria-hidden="true" />
                        {{ preset.label }}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div class="grid gap-2">
                <Label id="court-paint-label">Paint (keys and centre circle)</Label>
                <div class="flex flex-wrap items-center gap-2" role="group" aria-labelledby="court-paint-label">
                    <button
                        v-for="swatch in PAINT_SWATCHES"
                        :key="swatch.value"
                        type="button"
                        class="court-swatch"
                        :class="{ selected: court.paint === swatch.value }"
                        :style="{ backgroundColor: swatch.value }"
                        :aria-label="swatch.label"
                        :aria-pressed="court.paint === swatch.value"
                        :disabled="disabled"
                        @click="setPaint(swatch.value)"
                    />
                    <button
                        type="button"
                        class="court-swatch court-swatch-none"
                        :class="{ selected: court.paint === null }"
                        aria-label="No paint"
                        title="No paint"
                        :aria-pressed="court.paint === null"
                        :disabled="disabled"
                        @click="setPaint(null)"
                    />
                    <ColorPicker
                        :model-value="court.paint ?? PAINT_SWATCHES[0].value"
                        :selected="isCustomPaint"
                        @update:model-value="(value: string) => withHex(value, setPaint)"
                    />
                </div>
            </div>

            <div class="grid gap-2">
                <Label id="court-apron-label">Apron</Label>
                <div class="flex flex-wrap items-center gap-2">
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        class="justify-start gap-1"
                        aria-labelledby="court-apron-label"
                        :model-value="apronMode"
                        :disabled="disabled"
                        @update:model-value="(mode) => setApronMode(mode as ApronMode)"
                    >
                        <ToggleGroupItem value="match" size="sm" :disabled="court.paint === null">Match paint</ToggleGroupItem>
                        <ToggleGroupItem value="stained" size="sm">Stained wood</ToggleGroupItem>
                        <ToggleGroupItem value="custom" size="sm">Custom</ToggleGroupItem>
                    </ToggleGroup>
                    <ColorPicker
                        v-if="apronMode === 'custom'"
                        :model-value="court.apron ?? PAINT_SWATCHES[0].value"
                        selected
                        @update:model-value="(value: string) => withHex(value, (apron) => update({ apron }))"
                    />
                </div>
            </div>

            <div class="grid gap-2">
                <Label id="court-lines-label">Lines</Label>
                <div class="flex flex-wrap items-center gap-2">
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        class="justify-start gap-1"
                        aria-labelledby="court-lines-label"
                        :model-value="linesMode"
                        :disabled="disabled"
                        @update:model-value="(mode) => setLinesMode(mode as LinesMode)"
                    >
                        <ToggleGroupItem v-for="preset in LINE_PRESETS" :key="preset.value" :value="preset.value" size="sm">
                            {{ preset.label }}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="custom" size="sm">Custom</ToggleGroupItem>
                    </ToggleGroup>
                    <ColorPicker
                        v-if="linesMode === 'custom'"
                        :model-value="court.lines"
                        selected
                        @update:model-value="(value: string) => withHex(value, (lines) => update({ lines }))"
                    />
                </div>
            </div>

            <div class="grid gap-2">
                <Label id="court-logo-label">Centre logo</Label>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    class="justify-start gap-1"
                    aria-labelledby="court-logo-label"
                    :model-value="court.centerLogo"
                    :disabled="disabled"
                    @update:model-value="(mode) => mode && update({ centerLogo: mode as CourtDesign['centerLogo'] })"
                >
                    <ToggleGroupItem value="none" size="sm">None</ToggleGroupItem>
                    <ToggleGroupItem value="team" size="sm">Team logo</ToggleGroupItem>
                    <ToggleGroupItem value="upload" size="sm">Upload</ToggleGroupItem>
                </ToggleGroup>
                <p v-if="court.centerLogo === 'team'" class="text-xs text-muted-foreground">
                    Team logo uses whichever team plays here.
                </p>
                <div v-if="court.centerLogo === 'upload'" class="grid gap-2">
                    <div class="flex flex-wrap items-center gap-3">
                        <img
                            v-if="uploadedLogo"
                            :src="uploadedLogo"
                            alt="Centre logo"
                            class="h-14 w-14 rounded-md border border-border bg-muted object-contain"
                        />
                        <Button as="label" for="court-logo" variant="outline" size="sm" :disabled="disabled || logoPreparing" class="cursor-pointer">
                            {{ logoPreparing ? 'Preparing logo…' : uploadedLogo ? 'Replace logo' : 'Choose image' }}
                        </Button>
                        <Button
                            v-if="uploadedLogo"
                            type="button"
                            variant="ghost"
                            size="sm"
                            :disabled="disabled"
                            class="text-destructive-strong hover:bg-destructive/10 hover:text-destructive-strong"
                            @click="emit('removeLogo')"
                        >
                            Remove logo
                        </Button>
                    </div>
                    <input
                        id="court-logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        class="sr-only"
                        :disabled="disabled"
                        @change="onLogoInput"
                    />
                    <p class="text-xs text-muted-foreground">PNG, JPEG or WebP. Resized to 512 pixels and kept as PNG.</p>
                    <p v-if="logoError" role="alert" class="text-sm text-destructive-strong">{{ logoError }}</p>
                    <p v-else-if="props.logoMissing" class="text-sm text-destructive-strong">
                        Choose an image, or pick None or Team logo.
                    </p>
                </div>
            </div>

            <div class="grid gap-2">
                <Label for="court-baseline">Baseline text</Label>
                <Input
                    id="court-baseline"
                    :model-value="court.baselineText"
                    :maxlength="BASELINE_TEXT_MAX"
                    placeholder="Harbor Pavilion"
                    :disabled="disabled"
                    aria-describedby="court-baseline-hint"
                    class="h-11"
                    @update:model-value="(value) => update({ baselineText: String(value) })"
                />
                <p id="court-baseline-hint" class="text-xs text-muted-foreground">
                    {{ court.baselineText.length }}/{{ BASELINE_TEXT_MAX }}. Colour picked for contrast with the apron.
                </p>
            </div>

            <div class="grid gap-2">
                <Label for="court-sideline">Sideline text</Label>
                <Input
                    id="court-sideline"
                    :model-value="court.sidelineText"
                    :maxlength="SIDELINE_TEXT_MAX"
                    placeholder="Seattle"
                    :disabled="disabled"
                    aria-describedby="court-sideline-hint"
                    class="h-11"
                    @update:model-value="(value) => update({ sidelineText: String(value) })"
                />
                <p id="court-sideline-hint" class="text-xs text-muted-foreground">
                    {{ court.sidelineText.length }}/{{ SIDELINE_TEXT_MAX }}
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.court-chip {
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: 0.0625rem solid hsl(var(--border));
}

/* Same shape and states as the jersey drawing's stroke swatches. */
.court-swatch {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    border: 0.125rem solid hsl(var(--border));
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.court-swatch:hover {
    border-color: hsl(var(--primary) / 0.6);
}

.court-swatch.selected {
    border-color: hsl(var(--primary-strong));
    box-shadow: 0 0 0 0.125rem hsl(var(--primary) / 0.3);
}

.court-swatch:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

/* Unpainted: an empty swatch struck through. */
.court-swatch-none {
    background:
        linear-gradient(135deg, transparent 45%, hsl(var(--destructive-strong)) 45% 55%, transparent 55%),
        hsl(var(--background));
}
</style>
