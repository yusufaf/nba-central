<script lang="ts">
// Not useId(): that counts per app, and the share card mounts its own app
// on the same document as the page's courts.
const instances = { count: 0 };
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { CourtDesign } from '@/models/api';
import {
    COURT_WOODS,
    apronColours,
    courtTextColour,
    fitFontSize,
    plankPaths,
    shade,
    woodTones,
} from '@/utils/court';

// One court, drawn from its settings, at any size: the designer preview,
// the stage behind the starting five, the share card and the thumbnails.
// Units are tenths of a foot on a 94 x 50 ft court, inside an apron band.
const props = withDefaults(
    defineProps<{
        court: CourtDesign;
        // Already resolved from court.centerLogo (see centreLogoUrl).
        logoUrl?: string;
        // How the court fills a box of another shape. The share card crops
        // from the top, so the sideline text along the bottom survives.
        preserveAspectRatio?: string;
        decorative?: boolean;
        label?: string;
    }>(),
    { logoUrl: undefined, preserveAspectRatio: 'xMidYMid meet', decorative: false, label: 'Court design' },
);

const WIDTH = 1040;
const HEIGHT = 580;
const LEFT = 50;
const RIGHT = 990;
const TOP = 40;
const BOTTOM = 540;
const MID_X = 520;
const MID_Y = 290;

const KEY_LENGTH = 190;
const KEY_HALF_WIDTH = 80;
const CIRCLE_RADIUS = 60;
const BASKET_OFFSET = 52.5;
const BACKBOARD_OFFSET = 40;
const RESTRICTED_RADIUS = 40;
const THREE_RADIUS = 237.5;
const THREE_CORNER = 30;
// Where the arc meets the corner line, measured from the basket.
const THREE_ARC_X = Math.sqrt(THREE_RADIUS ** 2 - (MID_Y - TOP - THREE_CORNER) ** 2);

const FLOOR_SEED = 11;
const APRON_SEED = 29;

// Both halves, mirrored: `dir` points from the baseline towards centre court.
const ends = [
    { baseline: LEFT, dir: 1 },
    { baseline: RIGHT, dir: -1 },
].map(({ baseline, dir }) => {
    const freeThrow = baseline + KEY_LENGTH * dir;
    const basket = baseline + BASKET_OFFSET * dir;
    const threeX = basket + THREE_ARC_X * dir;
    const towardsCentre = dir > 0 ? 1 : 0;
    const top = MID_Y - CIRCLE_RADIUS;
    const bottom = MID_Y + CIRCLE_RADIUS;
    return {
        key: { x: dir > 0 ? baseline : freeThrow, y: MID_Y - KEY_HALF_WIDTH, width: KEY_LENGTH, height: KEY_HALF_WIDTH * 2 },
        freeThrowOuter: `M${freeThrow} ${top}A${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 ${towardsCentre} ${freeThrow} ${bottom}`,
        freeThrowInner: `M${freeThrow} ${top}A${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 ${1 - towardsCentre} ${freeThrow} ${bottom}`,
        basket,
        backboard: baseline + BACKBOARD_OFFSET * dir,
        restricted: `M${basket} ${MID_Y - RESTRICTED_RADIUS}A${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 ${towardsCentre} ${basket} ${MID_Y + RESTRICTED_RADIUS}`,
        three: `M${baseline} ${TOP + THREE_CORNER}H${threeX}A${THREE_RADIUS} ${THREE_RADIUS} 0 0 ${towardsCentre} ${threeX} ${BOTTOM - THREE_CORNER}H${baseline}`,
    };
});

const clipId = `court-logo-${++instances.count}`;

const floorTones = computed(() => woodTones(props.court.wood));
const floorPlanks = computed(() =>
    plankPaths(FLOOR_SEED, { x: LEFT, y: TOP, width: RIGHT - LEFT, height: BOTTOM - TOP }, floorTones.value.length),
);

// A null apron is the floor's wood, stained darker.
const apronTones = computed(() => (props.court.apron ? [] : apronColours(props.court)));
const apronPlanks = computed(() =>
    props.court.apron ? [] : plankPaths(APRON_SEED, { x: 0, y: 0, width: WIDTH, height: HEIGHT }, apronTones.value.length),
);
const apronSeam = computed(() => shade(COURT_WOODS[props.court.wood].base, -COURT_WOODS[props.court.wood].stain - 0.12));
const floorSeam = computed(() => shade(COURT_WOODS[props.court.wood].base, -0.14));

const paint = computed(() => props.court.paint ?? 'none');
const line = computed(() => ({ stroke: props.court.lines, 'stroke-width': 4, fill: 'none' }));

const textColour = computed(() => courtTextColour(props.court));
const baselineText = computed(() => props.court.baselineText.trim().toLocaleUpperCase());
const sidelineText = computed(() => props.court.sidelineText.trim().toLocaleUpperCase());
const baselineSize = computed(() => fitFontSize(baselineText.value, BOTTOM - TOP - 30, 28));
const sidelineSize = computed(() => fitFontSize(sidelineText.value, RIGHT - LEFT - 40, 26));
</script>

<template>
    <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        :preserveAspectRatio="preserveAspectRatio"
        xmlns="http://www.w3.org/2000/svg"
        class="block h-full w-full"
        :role="decorative ? undefined : 'img'"
        :aria-label="decorative ? undefined : label"
        :aria-hidden="decorative ? 'true' : undefined"
    >
        <defs>
            <clipPath :id="clipId">
                <circle :cx="MID_X" :cy="MID_Y" :r="CIRCLE_RADIUS - 4" />
            </clipPath>
        </defs>

        <rect v-if="court.apron" data-part="apron" x="0" y="0" :width="WIDTH" :height="HEIGHT" :fill="court.apron" />
        <g v-else data-part="apron-planks">
            <rect x="0" y="0" :width="WIDTH" :height="HEIGHT" :fill="apronSeam" />
            <path v-for="(d, i) in apronPlanks" :key="i" :d="d" :fill="apronTones[i]" />
        </g>

        <rect :x="LEFT" :y="TOP" :width="RIGHT - LEFT" :height="BOTTOM - TOP" :fill="floorSeam" />
        <g data-part="floor">
            <path v-for="(d, i) in floorPlanks" :key="i" :d="d" :fill="floorTones[i]" />
        </g>

        <g>
            <rect v-for="(end, i) in ends" :key="i" data-part="paint" v-bind="end.key" :fill="paint" />
            <circle data-part="paint" :cx="MID_X" :cy="MID_Y" :r="CIRCLE_RADIUS" :fill="paint" />
        </g>

        <image
            v-if="logoUrl"
            :href="logoUrl"
            :x="MID_X - 50"
            :y="MID_Y - 50"
            width="100"
            height="100"
            preserveAspectRatio="xMidYMid meet"
            :clip-path="`url(#${clipId})`"
        />

        <g data-part="lines" stroke-linecap="butt">
            <rect :x="LEFT" :y="TOP" :width="RIGHT - LEFT" :height="BOTTOM - TOP" v-bind="line" />
            <path :d="`M${MID_X} ${TOP}V${BOTTOM}`" v-bind="line" />
            <circle :cx="MID_X" :cy="MID_Y" :r="CIRCLE_RADIUS" v-bind="line" />
            <g v-for="(end, i) in ends" :key="i">
                <rect v-bind="{ ...end.key, ...line }" />
                <path :d="end.freeThrowOuter" v-bind="line" />
                <path :d="end.freeThrowInner" v-bind="line" stroke-dasharray="10 8" />
                <path :d="end.three" v-bind="line" />
                <path :d="end.restricted" v-bind="line" />
                <path :d="`M${end.backboard} ${MID_Y - 30}V${MID_Y + 30}`" v-bind="line" />
                <circle :cx="end.basket" :cy="MID_Y" r="7.5" v-bind="line" />
            </g>
        </g>

        <g font-weight="800" letter-spacing="0.14em" text-anchor="middle" dominant-baseline="central">
            <template v-if="baselineText">
                <text
                    data-part="baseline-text"
                    :x="LEFT / 2"
                    :y="MID_Y"
                    :transform="`rotate(-90 ${LEFT / 2} ${MID_Y})`"
                    :font-size="baselineSize"
                    :fill="textColour"
                >{{ baselineText }}</text>
                <text
                    data-part="baseline-text"
                    :x="WIDTH - LEFT / 2"
                    :y="MID_Y"
                    :transform="`rotate(90 ${WIDTH - LEFT / 2} ${MID_Y})`"
                    :font-size="baselineSize"
                    :fill="textColour"
                >{{ baselineText }}</text>
            </template>
            <text
                v-if="sidelineText"
                data-part="sideline-text"
                :x="MID_X"
                :y="BOTTOM + (HEIGHT - BOTTOM) / 2"
                :font-size="sidelineSize"
                :fill="textColour"
            >{{ sidelineText }}</text>
        </g>
    </svg>
</template>
