<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Pencil, RefreshCw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import UserAvatar from '@/components/UserAvatar.vue';
import AvatarPickerDialog from '@/components/Settings/AvatarPickerDialog.vue';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useSettingsSync } from '@/composables/useSettingsSync';
import { useDateFormat } from '@/composables/useDateFormat';
import { profileApi } from '@/network/api';
import type { UserStats } from '@/models/api';

const { currentUser } = useCurrentUser();
const { status } = useSettingsSync();
const { formatDate } = useDateFormat();

const pickerOpen = ref(false);
// The avatar is a synced setting, so it can only be changed once the
// account's settings have loaded.
const canEdit = computed(() => status.value === 'ready');

const memberSince = computed(() => {
    const date = currentUser.value?.memberSince;
    return date ? `Member since ${formatDate(date, 'medium')}` : null;
});

const stats = ref<UserStats | null>(null);
const statsFailed = ref(false);

const loadStats = async () => {
    statsFailed.value = false;
    try {
        const response = await profileApi.getStats();
        if (!response.success) throw new Error(response.error);
        stats.value = response.data;
    } catch (error) {
        console.error('Failed to load profile stats:', error);
        statsFailed.value = true;
    }
};

onMounted(loadStats);

const STAT_LABELS: { key: keyof UserStats; label: string }[] = [
    { key: 'teams', label: 'Saved teams' },
    { key: 'publishedTeams', label: 'Published' },
    { key: 'customCoaches', label: 'Custom coaches' },
    { key: 'customGMs', label: 'Custom GMs' },
    { key: 'customPlayers', label: 'Custom players' },
];
</script>

<template>
    <Card data-testid="profile-card">
        <CardContent class="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center">
            <button
                type="button"
                class="group relative shrink-0 self-start rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:self-center"
                :disabled="!canEdit"
                aria-label="Change avatar"
                data-testid="change-avatar"
                @click="pickerOpen = true"
            >
                <UserAvatar class="size-16" />
                <span
                    v-if="canEdit"
                    class="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border border-border bg-card text-foreground/80 group-hover:text-primary-strong"
                    aria-hidden="true"
                >
                    <Pencil class="size-3" />
                </span>
            </button>

            <div class="flex min-w-0 flex-1 flex-col gap-3">
                <div class="min-w-0">
                    <p class="truncate text-[1.125rem] font-semibold">
                        {{ currentUser?.username ?? 'Your account' }}
                    </p>
                    <p v-if="memberSince" class="text-[0.8125rem] text-foreground/60">
                        {{ memberSince }}
                    </p>
                </div>

                <div
                    v-if="statsFailed"
                    class="flex flex-wrap items-center gap-3 text-[0.8125rem] text-foreground/60"
                >
                    Couldn't load your counts.
                    <Button variant="outline" size="sm" @click="loadStats">
                        <RefreshCw class="size-4" />
                        Reload counts
                    </Button>
                </div>
                <!-- auto-fit at 6.5rem: five counts in a row on a laptop, two or
                     three per row on a phone or at a large Text size. -->
                <dl
                    v-else
                    class="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-x-4 gap-y-3"
                    :aria-busy="!stats || undefined"
                >
                    <div
                        v-for="stat in STAT_LABELS"
                        :key="stat.key"
                        class="flex flex-col"
                        :data-testid="`stat-${stat.key}`"
                    >
                        <dt class="order-2 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-foreground/50">
                            {{ stat.label }}
                        </dt>
                        <dd class="order-1 text-[1.125rem] font-bold tabular-nums">
                            {{ stats ? stats[stat.key] : '–' }}
                        </dd>
                    </div>
                </dl>
            </div>
        </CardContent>

        <!-- Inside the card so the component keeps one root for its class;
             the dialog itself is portalled to <body>. -->
        <AvatarPickerDialog v-model:open="pickerOpen" />
    </Card>
</template>
