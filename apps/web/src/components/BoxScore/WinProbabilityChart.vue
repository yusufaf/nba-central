<template>
    <div class="relative">
        <svg
            ref="chart"
            class="wp-chart block w-full h-48 sm:h-56"
            :viewBox="`0 0 ${width} ${height}`"
            role="img"
            :aria-label="ariaLabel"
        >
            <defs>
                <clipPath :id="aboveId">
                    <rect x="0" y="0" :width="width" :height="midY" />
                </clipPath>
                <clipPath :id="belowId">
                    <rect x="0" :y="midY" :width="width" :height="Math.max(0, height - midY)" />
                </clipPath>
            </defs>

            <line
                v-for="boundary in boundaries"
                :key="boundary"
                data-testid="wp-gridline"
                class="wp-grid"
                :x1="boundary"
                :x2="boundary"
                :y1="padT"
                :y2="padT + plotH"
            />
            <line class="wp-grid wp-mid" :x1="padL" :x2="padL + plotW" :y1="midY" :y2="midY" />
            <text
                v-for="label in periodLabels"
                :key="label.text"
                class="wp-label"
                :x="label.x"
                :y="height - 0.375 * rem"
                text-anchor="middle"
            >{{ label.text }}</text>
            <text class="wp-label" :x="padL - 0.375 * rem" :y="padT" dominant-baseline="hanging" text-anchor="end">{{ teams.home }}</text>
            <text class="wp-label" :x="padL - 0.375 * rem" :y="midY" dominant-baseline="middle" text-anchor="end">50%</text>
            <text class="wp-label" :x="padL - 0.375 * rem" :y="padT + plotH" text-anchor="end">{{ teams.away }}</text>

            <path data-testid="wp-area" :d="areaPath" :fill="colors.home.fill" fill-opacity="0.2" :clip-path="`url(#${aboveId})`" />
            <path data-testid="wp-area" :d="areaPath" :fill="colors.away.fill" fill-opacity="0.2" :clip-path="`url(#${belowId})`" />
            <path data-testid="wp-line" :d="linePath" fill="none" :stroke="colors.home.fill" stroke-width="2" stroke-linejoin="round" :clip-path="`url(#${aboveId})`" />
            <path data-testid="wp-line" :d="linePath" fill="none" :stroke="colors.away.fill" stroke-width="2" stroke-linejoin="round" :clip-path="`url(#${belowId})`" />

            <g
                v-for="swing in swings"
                :key="swing.point.playId"
                data-testid="wp-swing"
                :data-active="swing.point.playId === activePlayId ? '' : undefined"
                :transform="`translate(${x(swing.point.elapsed).toFixed(1)} ${y(swing.point.homeWp).toFixed(1)})`"
            >
                <circle
                    :r="swing.point.playId === activePlayId ? 0.625 * rem : 0.5 * rem"
                    :fill="sideColor(swing).fill"
                    :class="{ 'wp-dot-active': swing.point.playId === activePlayId }"
                />
                <text class="wp-dot-label" text-anchor="middle" dominant-baseline="central" :fill="sideColor(swing).ink">{{ swing.rank }}</text>
            </g>

            <g v-if="hoverPoint" data-testid="wp-cursor">
                <line class="wp-cursor" :x1="x(hoverPoint.elapsed)" :x2="x(hoverPoint.elapsed)" :y1="padT" :y2="padT + plotH" />
                <circle class="wp-cursor-dot" :cx="x(hoverPoint.elapsed)" :cy="y(hoverPoint.homeWp)" :r="0.25 * rem" />
            </g>

            <!-- Painted last and the only element that takes the pointer, so
                 the cursor line just left of it never steals a pointerleave. -->
            <rect
                class="wp-scrub"
                :x="padL"
                :y="padT"
                :width="plotW"
                :height="plotH"
                fill="transparent"
                @pointerdown="onPointer"
                @pointermove="onPointer"
                @pointerleave="hoverElapsed = null"
                @pointercancel="hoverElapsed = null"
                @pointerup="onPointerUp"
            />
        </svg>

        <div
            v-if="tooltipPoint"
            data-testid="wp-tooltip"
            class="absolute bg-popover text-popover-foreground border rounded-md shadow-sm p-2 text-[0.75rem] pointer-events-none max-w-[16rem]"
            :style="tooltipStyle"
        >
            <p class="text-foreground/60 tabular-nums">{{ periodLabel(tooltipPoint.period) }} · {{ tooltipPoint.clock }}</p>
            <p class="font-medium">{{ tooltipPoint.text }}</p>
            <p class="tabular-nums">{{ teams.away }} {{ tooltipPoint.awayScore }} – {{ teams.home }} {{ tooltipPoint.homeScore }}</p>
            <p class="flex items-center gap-2 tabular-nums">
                <span class="inline-flex items-center gap-1">
                    <span class="inline-block size-2 rounded-full" :style="{ background: colors.home.fill }" />
                    {{ teams.home }} {{ formatWp(tooltipPoint.homeWp) }}
                </span>
                <span class="inline-flex items-center gap-1">
                    <span class="inline-block size-2 rounded-full" :style="{ background: colors.away.fill }" />
                    {{ teams.away }} {{ formatWp(1 - tooltipPoint.homeWp) }}
                </span>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useDisplayPreferences } from '@/composables/useDisplayPreferences';
import {
    formatWp,
    gameLength,
    periodLabel,
    periodLength,
    pointIndexAt,
    type WpPoint,
    type WpSwing,
    type WpTeamColor,
} from '@/utils/winProbability';

const props = defineProps<{
    series: WpPoint[];
    swings: WpSwing[];
    colors: { home: WpTeamColor; away: WpTeamColor };
    teams: { home: string; away: string };
    periods: number;
    activePlayId: string | null;
}>();

// The svg, not its wrapper: a grid row can stretch the wrapper taller.
const chart = ref<SVGSVGElement | null>(null);
const size = useElementSize(chart);
// jsdom measures 0; draw at a typical size there.
const width = computed(() => size.width.value || 600);
const height = computed(() => size.height.value || 192);

// The chart is drawn in pixels, so its gutters follow Text size by hand.
const { preferences } = useDisplayPreferences();
const rem = computed(() => {
    void preferences.value.fontScale;
    void size.height.value;
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
});

const padL = computed(() => 2.5 * rem.value);
const padR = computed(() => 0.5 * rem.value);
const padT = computed(() => 0.75 * rem.value);
const padB = computed(() => 1.25 * rem.value);
const plotW = computed(() => Math.max(1, width.value - padL.value - padR.value));
const plotH = computed(() => Math.max(1, height.value - padT.value - padB.value));
const totalSeconds = computed(() => gameLength(props.periods));

const x = (elapsed: number) => padL.value + (elapsed / totalSeconds.value) * plotW.value;
const y = (homeWp: number) => padT.value + (1 - homeWp) * plotH.value;
const midY = computed(() => y(0.5));

const linePath = computed(() =>
    props.series
        .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.elapsed).toFixed(1)} ${y(point.homeWp).toFixed(1)}`)
        .join(' '),
);
const areaPath = computed(() => {
    const first = props.series[0];
    const last = props.series.at(-1);
    if (!first || !last) return '';
    const mid = midY.value.toFixed(1);
    return `${linePath.value} L${x(last.elapsed).toFixed(1)} ${mid} L${x(first.elapsed).toFixed(1)} ${mid} Z`;
});

const periodStarts = computed(() => {
    const starts = [0];
    for (let period = 1; period <= props.periods; period++) {
        starts.push(starts[period - 1] + periodLength(period));
    }
    return starts;
});
const boundaries = computed(() => periodStarts.value.slice(1, -1).map(x));
const periodLabels = computed(() =>
    periodStarts.value.slice(0, -1).map((start, i) => ({
        text: periodLabel(i + 1),
        x: x(start + periodLength(i + 1) / 2),
    })),
);

const uid = useId();
const aboveId = `${uid}-wp-above`;
const belowId = `${uid}-wp-below`;

const sideColor = (swing: WpSwing) => props.colors[swing.point.side ?? 'home'];

// The hovered time, not an index, so a live poll that adds a late play
// re-resolves to whatever play is at that time.
const hoverElapsed = ref<number | null>(null);

const onPointer = (event: PointerEvent) => {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    if (box.width <= 0) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    hoverElapsed.value = fraction * totalSeconds.value;
};

// A touch or pen lift ends the scrub; a mouse click keeps the tooltip.
const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') hoverElapsed.value = null;
};

const hoverIndex = computed(() => {
    const last = props.series.at(-1);
    if (hoverElapsed.value === null || !last) return null;
    // Past the end of a live game's line: nothing to show yet.
    if (hoverElapsed.value > last.elapsed + 0.02 * totalSeconds.value) return null;
    return pointIndexAt(props.series, hoverElapsed.value);
});
const hoverPoint = computed(() => (hoverIndex.value === null ? null : props.series[hoverIndex.value]));

const activeSwing = computed(() => props.swings.find((s) => s.point.playId === props.activePlayId) ?? null);
const tooltipPoint = computed(() => hoverPoint.value ?? activeSwing.value?.point ?? null);

const tooltipStyle = computed(() => {
    const point = tooltipPoint.value;
    if (!point) return {};
    const anchor = x(point.elapsed);
    const r = rem.value;
    return anchor <= 0.6 * width.value
        ? { top: '0.25rem', left: `${Math.max(0, anchor / r + 0.5)}rem` }
        : { top: '0.25rem', right: `${Math.max(0, (width.value - anchor) / r + 0.5)}rem` };
});

const ariaLabel = computed(() => {
    const last = props.series.at(-1);
    if (!last) return 'Win probability chart';
    return `Win probability chart, ${props.teams.home} ${formatWp(last.homeWp)} to ${props.teams.away} ${formatWp(1 - last.homeWp)}`;
});
</script>

<style scoped>
.wp-chart {
    touch-action: pan-y;
}

.wp-chart :not(.wp-scrub) {
    pointer-events: none;
}

.wp-grid {
    stroke: hsl(var(--border));
    stroke-width: 1;
}

.wp-mid {
    stroke-dasharray: 4 4;
}

.wp-label {
    fill: hsl(var(--muted-foreground));
    font-size: 0.6875rem;
}

.wp-dot-label {
    font-size: 0.625rem;
    font-weight: 700;
}

.wp-dot-active {
    stroke: hsl(var(--foreground));
    stroke-width: 2;
}

.wp-cursor {
    stroke: hsl(var(--foreground) / 0.5);
    stroke-width: 1;
}

.wp-cursor-dot {
    fill: hsl(var(--foreground));
}
</style>
