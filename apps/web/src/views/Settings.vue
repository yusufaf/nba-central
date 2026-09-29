<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLogto } from '@logto/vue';
import { LogOut, RefreshCw } from 'lucide-vue-next';
import PageShell from '@/layouts/PageShell.vue';
import SectionHeading from '@/components/layout/SectionHeading.vue';
import SettingRow from '@/components/Settings/SettingRow.vue';
import CustomSwitch from '@/components/Scores/CustomSwitch.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePlayerStatsPreferences } from '@/composables/usePlayerStatsPreferences';
import { useScoresPreferences } from '@/composables/useScoresPreferences';
import { useSettingsSync } from '@/composables/useSettingsSync';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { VIEW_OPTIONS } from '@/constants/constants';
import type { SeasonFormat, StatDisplayMode } from '@/constants/playerStats';

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
const { signOut } = useLogto();
const { currentUser } = useCurrentUser();
const { status, isSaving, retry } = useSettingsSync();
const { preferences: playerStats } = usePlayerStatsPreferences();
const { preferences: scores } = useScoresPreferences();

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

// A single-select ToggleGroup emits '' when the selected item is clicked
// again; keep the current value instead of clearing it.
const choose = <T extends string>(apply: (value: T) => void) => (value: unknown) => {
    if (typeof value === 'string' && value) apply(value as T);
};
const setSeasonFormat = choose<SeasonFormat>((v) => (playerStats.value.seasonFormat = v));
const setStatMode = choose<StatDisplayMode>((v) => (playerStats.value.statMode = v));
const setConferenceFilter = choose((v) => (scores.value.conferenceFilter = v));
const setSelectedView = choose((v) => (scores.value.selectedView = v));

const handleSignOut = () => {
    signOut(window.location.origin);
};
</script>

<template>
    <PageShell width="narrow">
        <h1 class="mb-6 text-[2rem] font-bold">Settings</h1>

        <Tabs :model-value="activeTab" @update:model-value="onTabChange">
            <TabsList class="mb-6 h-auto gap-0.5 bg-muted/30 p-1">
                <TabsTrigger
                    v-for="tab in TABS"
                    :key="tab.value"
                    :value="tab.value"
                    class="px-4 py-2 font-medium text-foreground/60 hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:font-semibold data-[state=active]:text-primary"
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
                </div>
            </TabsContent>

            <TabsContent value="account">
                <Card>
                    <CardContent class="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div class="min-w-0">
                            <p class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-foreground/50">
                                Signed in as
                            </p>
                            <p class="truncate text-[1.125rem] font-semibold">
                                {{ currentUser?.username ?? 'Your account' }}
                            </p>
                            <p class="mt-1 text-[0.8125rem] text-foreground/60">
                                Your yusufaf.dev sign-in. Settings here apply to NBA Central only.
                            </p>
                        </div>
                        <Button variant="outline" class="self-start sm:self-auto" @click="handleSignOut">
                            <LogOut class="size-4" />
                            Log out
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </PageShell>
</template>
