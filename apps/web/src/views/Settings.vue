<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { RefreshCw } from 'lucide-vue-next';
import { usePreferredDark, usePreferredReducedMotion } from '@vueuse/core';
import PageShell from '@/layouts/PageShell.vue';
import SectionHeading from '@/components/layout/SectionHeading.vue';
import SettingRow from '@/components/Settings/SettingRow.vue';
import ProfileCard from '@/components/Settings/ProfileCard.vue';
import AccountPanel from '@/components/Settings/AccountPanel.vue';
import CustomSwitch from '@/components/Scores/CustomSwitch.vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePlayerStatsPreferences } from '@/composables/usePlayerStatsPreferences';
import { useScoresPreferences } from '@/composables/useScoresPreferences';
import { useTeamBuilderPreferences } from '@/composables/useTeamBuilderPreferences';
import { useDisplayPreferences } from '@/composables/useDisplayPreferences';
import { useDateFormat } from '@/composables/useDateFormat';
import { useSettingsSync } from '@/composables/useSettingsSync';
import { VIEW_OPTIONS } from '@/constants/constants';
import type { SeasonFormat, StatDisplayMode } from '@/constants/playerStats';
import {
    FONT_SCALES,
    THEME_OPTIONS,
    type FontScale,
    type ReducedMotion,
    type Theme,
    type UndoToastSeconds,
} from '@/constants/preferences';
import type { DateFormat, TimeFormat } from '@/utils/date';
import type { DrawerSide } from '@/models/types';

const TABS = [
    { value: 'preferences', label: 'Preferences' },
    { value: 'account', label: 'Account' },
] as const;
type Tab = (typeof TABS)[number]['value'];
const DEFAULT_TAB: Tab = 'preferences';

const isTab = (value: unknown): value is Tab =>
    TABS.some((tab) => tab.value === value);

const route = useRoute();
const router = useRouter();
const { status, isSaving, retry } = useSettingsSync();
const { preferences: playerStats } = usePlayerStatsPreferences();
const { preferences: scores } = useScoresPreferences();
const { preferences: teamBuilder } = useTeamBuilderPreferences();
const { preferences: display } = useDisplayPreferences();
const { formatDate, formatTime } = useDateFormat();
const osMotion = usePreferredReducedMotion();
const osDark = usePreferredDark();

// The tab lives in the URL (?tab=preferences) so it can be linked to and
// survives a reload. replace, not push: switching tabs shouldn't fill the
// back button, same as the Scores filters.
const activeTab = computed<Tab>({
    get: () => (isTab(route.query.tab) ? route.query.tab : DEFAULT_TAB),
    set: (tab) => {
        router.replace({ query: { ...route.query, tab } });
    },
});

watch(
    () => route.query.tab,
    (tab) => {
        if (!isTab(tab)) {
            router.replace({ query: { ...route.query, tab: DEFAULT_TAB } });
        }
    },
    { immediate: true },
);

const onTabChange = (tab: string | number) => {
    if (isTab(tab)) activeTab.value = tab;
};

const seasonFormatOptions: { value: SeasonFormat; sample: string }[] = [
    { value: 'YYYY-YY', sample: '2010-11' },
    { value: 'YYYY-YYYY', sample: '2010-2011' },
    { value: 'YYYY', sample: '2010' },
    { value: 'YYYY+1', sample: '2011' },
];

const statModeOptions: { value: StatDisplayMode; label: string }[] = [
    { value: 'per_game', label: 'Per game' },
    { value: 'totals', label: 'Totals' },
];

const conferenceOptions = [
    { value: 'ALL', label: 'All' },
    { value: 'EAST', label: 'East' },
    { value: 'WEST', label: 'West' },
    { value: 'CROSS', label: 'E v W' },
];

const undoToastOptions: UndoToastSeconds[] = ['5', '8', '15', '30'];

const drawerSideOptions: { value: DrawerSide; label: string }[] = [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
];

const dateFormatOptions: { value: DateFormat; label: string }[] = [
    { value: 'auto', label: 'Automatic' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
];

const timeFormatOptions: { value: TimeFormat; label: string }[] = [
    { value: 'auto', label: 'Automatic' },
    { value: '12h', label: '12-hour' },
    { value: '24h', label: '24-hour' },
];

const reducedMotionOptions: { value: ReducedMotion; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'reduce', label: 'Reduce' },
    { value: 'allow', label: 'Allow' },
];

// A sample of each format, so a choice shows what it does on the spot.
const now = new Date();
const dateSample = computed(() => `Today: ${formatDate(now, 'long')}`);
const timeSample = computed(() => `Now: ${formatTime(now)}`);
const themeDescription = computed(
    () => `System follows this device, which is set to ${osDark.value ? 'dark' : 'light'}.`,
);
const motionDescription = computed(
    () =>
        'Turns off non-essential animation, like the home page video and the typing headline. ' +
        `System follows this device, which ${osMotion.value === 'reduce' ? 'asks for less motion' : 'allows motion'}.`,
);

// While the thumb is dragged, the step under it previews on a sample line
// only. Rescaling the page mid-drag would resize and move the slider out from
// under the pointer. Letting go (or a key press) saves the step, and the
// whole page follows.
const draggedFontScale = ref<FontScale | null>(null);
const fontScale = computed(() => draggedFontScale.value ?? display.value.fontScale);
const fontScaleValue = computed(() => [Number(fontScale.value)]);
// The sample's size relative to the page as it is now (rem already carries
// the saved scale).
const fontScaleSampleRatio = computed(
    () => Number(fontScale.value) / Number(display.value.fontScale),
);
const toFontScale = (value: number[] | undefined): FontScale | null => {
    const scale = String(value?.[0]);
    return FONT_SCALES.includes(scale as FontScale) ? (scale as FontScale) : null;
};
// reka only commits a value that changed during the drag, so a drag that
// ends on the saved step never commits: that step clears the preview instead.
const onFontScaleDrag = (value: number[] | undefined) => {
    const scale = toFontScale(value);
    if (scale) draggedFontScale.value = scale === display.value.fontScale ? null : scale;
};
const onFontScaleCommit = (value: number[]) => {
    const scale = toFontScale(value);
    if (scale) display.value.fontScale = scale;
    draggedFontScale.value = null;
};

// A single-select ToggleGroup emits '' when the selected item is clicked
// again; keep the current value instead of clearing it.
const choose = <T extends string>(apply: (value: T) => void) => (value: unknown) => {
    if (typeof value === 'string' && value) apply(value as T);
};
const setSeasonFormat = choose<SeasonFormat>((v) => (playerStats.value.seasonFormat = v));
const setStatMode = choose<StatDisplayMode>((v) => (playerStats.value.statMode = v));
const setConferenceFilter = choose((v) => (scores.value.conferenceFilter = v));
const setSelectedView = choose((v) => (scores.value.selectedView = v));
const setUndoToastSeconds = choose<UndoToastSeconds>((v) => (teamBuilder.value.undoToastSeconds = v));
const setDrawerSide = choose<DrawerSide>((v) => (teamBuilder.value.drawerSide = v));
const setDateFormat = choose<DateFormat>((v) => (display.value.dateFormat = v));
const setTimeFormat = choose<TimeFormat>((v) => (display.value.timeFormat = v));
const setReducedMotion = choose<ReducedMotion>((v) => (display.value.reducedMotion = v));
const setTheme = choose<Theme>((v) => (display.value.theme = v));
</script>

<template>
    <PageShell width="narrow">
        <h1 class="mb-6 text-[2rem] font-bold">Settings</h1>

        <ProfileCard class="mb-6" />

        <Tabs :model-value="activeTab" @update:model-value="onTabChange">
            <TabsList class="mb-6 h-auto gap-0.5 bg-muted/30 p-1">
                <TabsTrigger
                    v-for="tab in TABS"
                    :key="tab.value"
                    :value="tab.value"
                    class="px-4 py-2 font-medium text-foreground/60 hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:font-semibold data-[state=active]:text-primary-strong"
                >
                    {{ tab.label }}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="preferences">
                <p
                    v-if="status === 'loading' || status === 'signed-out'"
                    class="text-foreground/60"
                    role="status"
                >
                    Loading your settings...
                </p>

                <Card v-else-if="status === 'error'" class="p-6">
                    <p class="font-semibold">Couldn't load your settings.</p>
                    <p class="mt-1 text-[0.8125rem] text-foreground/60">
                        Until they load, changes you make elsewhere stay on this device.
                    </p>
                    <Button variant="outline" size="sm" class="mt-4" @click="retry">
                        <RefreshCw class="size-4" />
                        Try again
                    </Button>
                </Card>

                <div v-else class="flex flex-col gap-8">
                    <p class="text-[0.8125rem] text-foreground/60">
                        Saved to your account as you change them, and used on every device
                        you sign in on.
                    </p>

                    <section class="flex flex-col gap-3">
                        <SectionHeading>Player stats</SectionHeading>
                        <Card class="px-6 py-2">
                            <SettingRow
                                label="Season format"
                                description="How seasons are labelled in a player's stats table."
                                :saving="isSaving('playerStats.seasonFormat')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="flex-wrap justify-start"
                                    aria-label="Season format"
                                    :model-value="playerStats.seasonFormat"
                                    :disabled="isSaving('playerStats.seasonFormat')"
                                    @update:model-value="setSeasonFormat"
                                >
                                    <ToggleGroupItem
                                        v-for="option in seasonFormatOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.sample }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Stat values"
                                description="Averages per game, or season sums."
                                :saving="isSaving('playerStats.statMode')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="justify-start"
                                    aria-label="Stat values"
                                    :model-value="playerStats.statMode"
                                    :disabled="isSaving('playerStats.statMode')"
                                    @update:model-value="setStatMode"
                                >
                                    <ToggleGroupItem
                                        v-for="option in statModeOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Career summary row"
                                description="Totals line pinned to the bottom of the table."
                                label-for="setting-show-career-summary"
                                :saving="isSaving('playerStats.showCareerSummary')"
                            >
                                <CustomSwitch
                                    id="setting-show-career-summary"
                                    :checked="playerStats.showCareerSummary"
                                    :disabled="isSaving('playerStats.showCareerSummary')"
                                    @update:checked="(v) => (playerStats.showCareerSummary = v)"
                                />
                            </SettingRow>

                            <SettingRow
                                label="Highlight career highs"
                                description="Each column's best season, in orange."
                                label-for="setting-highlight-career-highs"
                                :saving="isSaving('playerStats.highlightCareerHighs')"
                            >
                                <CustomSwitch
                                    id="setting-highlight-career-highs"
                                    :checked="playerStats.highlightCareerHighs"
                                    :disabled="isSaving('playerStats.highlightCareerHighs')"
                                    @update:checked="(v) => (playerStats.highlightCareerHighs = v)"
                                />
                            </SettingRow>
                        </Card>
                    </section>

                    <section class="flex flex-col gap-3">
                        <SectionHeading>Scores</SectionHeading>
                        <Card class="px-6 py-2">
                            <SettingRow
                                label="Conference filter"
                                description="Which games the scoreboard opens on."
                                :saving="isSaving('scores.conferenceFilter')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="flex-wrap justify-start"
                                    aria-label="Conference filter"
                                    :model-value="scores.conferenceFilter"
                                    :disabled="isSaving('scores.conferenceFilter')"
                                    @update:model-value="setConferenceFilter"
                                >
                                    <ToggleGroupItem
                                        v-for="option in conferenceOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Layout"
                                description="Game cards in a grid, or a compact list."
                                :saving="isSaving('scores.selectedView')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="justify-start"
                                    aria-label="Layout"
                                    :model-value="scores.selectedView"
                                    :disabled="isSaving('scores.selectedView')"
                                    @update:model-value="setSelectedView"
                                >
                                    <ToggleGroupItem
                                        v-for="option in VIEW_OPTIONS"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Short matchup names"
                                description="&quot;LAL @ BOS&quot; instead of full team names."
                                label-for="setting-use-short-names"
                                :saving="isSaving('scores.useShortNames')"
                            >
                                <CustomSwitch
                                    id="setting-use-short-names"
                                    :checked="scores.useShortNames"
                                    :disabled="isSaving('scores.useShortNames')"
                                    @update:checked="(v) => (scores.useShortNames = v)"
                                />
                            </SettingRow>

                            <SettingRow
                                label="Hide scores"
                                description="Spoiler-free scoreboard: no scores on any game card."
                                label-for="setting-hide-scores"
                                :saving="isSaving('scores.hideScores')"
                            >
                                <CustomSwitch
                                    id="setting-hide-scores"
                                    :checked="scores.hideScores"
                                    :disabled="isSaving('scores.hideScores')"
                                    @update:checked="(v) => (scores.hideScores = v)"
                                />
                            </SettingRow>

                            <SettingRow
                                label="Hide finished games"
                                description="Only show games that haven't ended."
                                label-for="setting-hide-finished-games"
                                :saving="isSaving('scores.hideFinishedGames')"
                            >
                                <CustomSwitch
                                    id="setting-hide-finished-games"
                                    :checked="scores.hideFinishedGames"
                                    :disabled="isSaving('scores.hideFinishedGames')"
                                    @update:checked="(v) => (scores.hideFinishedGames = v)"
                                />
                            </SettingRow>
                        </Card>
                    </section>

                    <section class="flex flex-col gap-3">
                        <SectionHeading>Team builder</SectionHeading>
                        <Card class="px-6 py-2">
                            <SettingRow
                                label="Confirm before resetting"
                                description="Ask before Reset clears the team. Off, it clears right away and you can undo it. Deleting a saved team or a custom coach, GM or player always asks."
                                label-for="setting-confirm-destructive"
                                :saving="isSaving('teamBuilder.confirmDestructive')"
                            >
                                <CustomSwitch
                                    id="setting-confirm-destructive"
                                    :checked="teamBuilder.confirmDestructive"
                                    :disabled="isSaving('teamBuilder.confirmDestructive')"
                                    @update:checked="(v) => (teamBuilder.confirmDestructive = v)"
                                />
                            </SettingRow>

                            <SettingRow
                                label="Undo notification"
                                description="How long the Undo button stays up after removing a player or resetting the team."
                                :saving="isSaving('teamBuilder.undoToastSeconds')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="justify-start"
                                    aria-label="Undo toast duration"
                                    :model-value="teamBuilder.undoToastSeconds"
                                    :disabled="isSaving('teamBuilder.undoToastSeconds')"
                                    @update:model-value="setUndoToastSeconds"
                                >
                                    <ToggleGroupItem
                                        v-for="seconds in undoToastOptions"
                                        :key="seconds"
                                        :value="seconds"
                                    >
                                        {{ seconds }}s
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Show actions on new cards"
                                description="Players join the roster with their card flipped to View Stats, Replace and Compare."
                                label-for="setting-flip-new-cards"
                                :saving="isSaving('teamBuilder.flipNewCards')"
                            >
                                <CustomSwitch
                                    id="setting-flip-new-cards"
                                    :checked="teamBuilder.flipNewCards"
                                    :disabled="isSaving('teamBuilder.flipNewCards')"
                                    @update:checked="(v) => (teamBuilder.flipNewCards = v)"
                                />
                            </SettingRow>

                            <SettingRow
                                label="Drawer side"
                                description="Where the coach, GM and arena pickers open."
                                :saving="isSaving('teamBuilder.drawerSide')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="justify-start"
                                    aria-label="Drawer side"
                                    :model-value="teamBuilder.drawerSide"
                                    :disabled="isSaving('teamBuilder.drawerSide')"
                                    @update:model-value="setDrawerSide"
                                >
                                    <ToggleGroupItem
                                        v-for="option in drawerSideOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>
                        </Card>
                    </section>

                    <section class="flex flex-col gap-3">
                        <SectionHeading>Display</SectionHeading>
                        <Card class="px-6 py-2">
                            <SettingRow
                                label="Theme"
                                :description="themeDescription"
                                :saving="isSaving('display.theme')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="flex-wrap justify-start"
                                    aria-label="Theme"
                                    :model-value="display.theme"
                                    :disabled="isSaving('display.theme')"
                                    @update:model-value="setTheme"
                                >
                                    <ToggleGroupItem
                                        v-for="option in THEME_OPTIONS"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Date format"
                                :description="`Dates on Scores, game pages, News and your teams. ${dateSample}`"
                                :saving="isSaving('display.dateFormat')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="flex-wrap justify-start"
                                    aria-label="Date format"
                                    :model-value="display.dateFormat"
                                    :disabled="isSaving('display.dateFormat')"
                                    @update:model-value="setDateFormat"
                                >
                                    <ToggleGroupItem
                                        v-for="option in dateFormatOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Time format"
                                :description="`Game start times. ${timeSample}`"
                                :saving="isSaving('display.timeFormat')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="flex-wrap justify-start"
                                    aria-label="Time format"
                                    :model-value="display.timeFormat"
                                    :disabled="isSaving('display.timeFormat')"
                                    @update:model-value="setTimeFormat"
                                >
                                    <ToggleGroupItem
                                        v-for="option in timeFormatOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Reduced motion"
                                :description="motionDescription"
                                :saving="isSaving('display.reducedMotion')"
                            >
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    class="flex-wrap justify-start"
                                    aria-label="Reduced motion"
                                    :model-value="display.reducedMotion"
                                    :disabled="isSaving('display.reducedMotion')"
                                    @update:model-value="setReducedMotion"
                                >
                                    <ToggleGroupItem
                                        v-for="option in reducedMotionOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </SettingRow>

                            <SettingRow
                                label="Text size"
                                description="Scales text and spacing across the app. Drag to preview; it applies and saves when you let go."
                                :saving="isSaving('display.fontScale')"
                            >
                                <!-- Not disabled while saving like the other controls:
                                     that would drop keyboard focus after every arrow
                                     key. A step taken mid-save is sent once it settles. -->
                                <div role="group" aria-label="Text size" class="flex flex-col gap-2">
                                <div class="flex items-center gap-3">
                                    <Slider
                                        class="w-40"
                                        :min="Number(FONT_SCALES[0])"
                                        :max="Number(FONT_SCALES[FONT_SCALES.length - 1])"
                                        :step="12.5"
                                        :model-value="fontScaleValue"
                                        @update:model-value="onFontScaleDrag"
                                        @value-commit="onFontScaleCommit"
                                    />
                                    <span class="w-14 text-right text-[0.8125rem] tabular-nums text-foreground/80">
                                        {{ fontScale }}%
                                    </span>
                                </div>
                                <!-- w-0 min-w-full: the sample wraps inside the slider's
                                     width rather than widening the column and moving it. -->
                                <p
                                    class="w-0 min-w-full text-[calc(0.9375rem*var(--sample-scale))] text-foreground/70"
                                    :style="{ '--sample-scale': fontScaleSampleRatio }"
                                    data-testid="text-size-sample"
                                >
                                    Hawks at Magic, {{ formatTime(now) }}
                                </p>
                                </div>
                            </SettingRow>
                        </Card>
                    </section>
                </div>
            </TabsContent>

            <TabsContent value="account">
                <AccountPanel />
            </TabsContent>
        </Tabs>
    </PageShell>
</template>
