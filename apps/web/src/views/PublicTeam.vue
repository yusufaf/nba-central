<script lang="ts">
// Module-scoped sequence number `load` (below) uses to detect a stale
// response: an in-flight request for an earlier teamUUID must not overwrite
// state after a later one has already resolved and rendered.
let requestSeq = 0;
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { Download, Link2, Share2, Sparkles } from 'lucide-vue-next';
import PageShell from '@/layouts/PageShell.vue';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { teamApi } from '@/network/api';
import type { PublicTeam } from '@/models/api';
import { averageRating, ratingTier } from '@/constants/ratings';
import { shareUrlFor } from '@/utils/shareUrl';
import { downloadUrlAsFile, slugFilename } from '@/utils/downloadFile';
import { track } from '@/lib/analytics';

const props = defineProps<{ teamUUID: string }>();
const router = useRouter();

const team = ref<PublicTeam | null>(null);
const loading = ref(true);
const notFound = ref(false);

const STARTER_SLOTS = [1, 2, 3, 4, 5];

const bySlot = computed(() => new Map((team.value?.roster ?? []).map((e) => [e.slot, e.player])));
const starters = computed(() => STARTER_SLOTS.flatMap((s) => (bySlot.value.get(s) ? [{ slot: s, player: bySlot.value.get(s)! }] : [])));
const bench = computed(() => (team.value?.roster ?? []).filter((e) => e.slot > 5).sort((a, b) => a.slot - b.slot));
const ratingOf = (player: { rating?: number; overallRating?: number }) => player.rating ?? player.overallRating;
const average = computed(() => averageRating(starters.value.map((s) => ratingOf(s.player))));
const location = computed(() => [team.value?.city, team.value?.country].filter(Boolean).join(', '));
const publishedOn = computed(() =>
    team.value?.publishedAt ? new Date(team.value.publishedAt).toLocaleDateString() : '',
);
const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

// A `load` function watched on the prop, not onMounted: navigating from
// /t/A to /t/B matches the same route record, so Vue Router reuses this
// component instance and onMounted never fires again - the page would keep
// showing team A.
const load = async (teamUUID: string) => {
    const seq = ++requestSeq;
    loading.value = true;
    notFound.value = false;
    team.value = null;
    try {
        const response = await teamApi.getPublicTeam(teamUUID);
        if (seq !== requestSeq) return;
        if (response.success) {
            team.value = response.data;
            track('public_team_viewed', { teamUUID });
        } else {
            notFound.value = true;
        }
    } catch (err) {
        if (seq !== requestSeq) return;
        console.error('Error loading public team:', err);
        notFound.value = true;
    } finally {
        if (seq === requestSeq) loading.value = false;
    }
};

watch(() => props.teamUUID, load, { immediate: true });

const share = async (method: 'copy' | 'native') => {
    const url = shareUrlFor(props.teamUUID);
    track('share_clicked', { method, page: 'public' });
    if (method === 'native' && canShareNatively) {
        try {
            await navigator.share({ title: team.value?.title, url });
        } catch {
            // Dismissed.
        }
        return;
    }
    try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
    } catch (err) {
        console.error('Clipboard write failed:', err);
        toast.error("Couldn't copy — copy it from your browser's address bar");
    }
};

const downloadCard = async () => {
    if (!team.value?.cardUrl) return;
    track('card_downloaded', { page: 'public' });
    try {
        await downloadUrlAsFile(team.value.cardUrl, slugFilename(team.value.title, 'png'));
    } catch (err) {
        console.error('Card download failed:', err);
        toast.error('Failed to download card');
    }
};

const remix = () => {
    track('remix_clicked', { teamUUID: props.teamUUID });
    router.push({ path: '/teambuilder', query: { remix: props.teamUUID } });
};
</script>

<template>
    <main>
        <PageShell>
            <div v-if="loading" class="text-muted-foreground">Loading team…</div>

            <div v-else-if="notFound || !team" data-testid="not-found" class="space-y-4 text-center">
                <h1 class="text-3xl font-bold">This team isn't public</h1>
                <p class="text-muted-foreground">The link may be wrong, or the owner made it private.</p>
                <router-link to="/teambuilder" :class="buttonVariants()">Build your own all-time franchise →</router-link>
            </div>

            <article v-else class="space-y-8">
                <header class="flex flex-wrap items-center gap-6">
                    <img v-if="team.logoUrl" :src="team.logoUrl" :alt="`${team.title} logo`" class="h-24 w-24 object-contain" />
                    <div class="min-w-0 flex-1">
                        <h1 class="truncate text-4xl font-bold">{{ team.title }}</h1>
                        <p v-if="location" class="text-muted-foreground">{{ location }}</p>
                        <p class="text-sm text-muted-foreground">
                            by {{ team.username }}<span v-if="publishedOn"> · published {{ publishedOn }}</span>
                        </p>
                    </div>
                    <img v-if="team.jerseyUrl" :src="team.jerseyUrl" :alt="`${team.title} jersey`" class="h-32 w-32 object-contain" />
                </header>

                <div class="flex flex-wrap gap-2">
                    <Button data-testid="copy-link-button" variant="outline" size="sm" @click="share('copy')"><Link2 class="mr-2 h-4 w-4" />Copy link</Button>
                    <Button v-if="canShareNatively" variant="outline" size="sm" @click="share('native')"><Share2 class="mr-2 h-4 w-4" />Share…</Button>
                    <Button data-testid="download-card-button" variant="outline" size="sm" :disabled="!team.cardUrl" @click="downloadCard"><Download class="mr-2 h-4 w-4" />Download card</Button>
                    <Button data-testid="remix-button" size="sm" @click="remix"><Sparkles class="mr-2 h-4 w-4" />Remix this team</Button>
                </div>

                <section>
                    <div class="mb-3 flex items-baseline justify-between">
                        <h2 class="text-xl font-semibold">Starting five</h2>
                        <Badge v-if="average !== null" :data-tier="ratingTier(average)">Avg {{ average }}</Badge>
                    </div>
                    <ul class="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <li v-for="{ slot, player } in starters" :key="slot" class="rounded-lg border border-border bg-card p-3">
                            <div class="text-xs uppercase text-muted-foreground">{{ player.position || '—' }}</div>
                            <div class="font-semibold">{{ player.fullName }}</div>
                            <div v-if="ratingOf(player) !== undefined" class="text-lg font-bold">{{ ratingOf(player) }}</div>
                        </li>
                    </ul>
                </section>

                <section v-if="bench.length">
                    <h2 class="mb-2 text-xl font-semibold">Bench</h2>
                    <ul class="grid grid-cols-2 gap-2 md:grid-cols-5">
                        <li v-for="{ slot, player } in bench" :key="slot" class="text-sm">
                            <span class="text-muted-foreground">{{ player.position || '—' }}</span> {{ player.fullName }}
                        </li>
                    </ul>
                </section>

                <section class="grid gap-3 md:grid-cols-3">
                    <div v-if="team.coach" class="rounded-lg border border-border p-3"><div class="text-xs uppercase text-muted-foreground">Coach</div><div class="font-semibold">{{ team.coach.name }}</div></div>
                    <div v-if="team.gm" class="rounded-lg border border-border p-3"><div class="text-xs uppercase text-muted-foreground">GM</div><div class="font-semibold">{{ team.gm.name }}</div></div>
                    <div v-if="team.arena" class="rounded-lg border border-border p-3"><div class="text-xs uppercase text-muted-foreground">Arena</div><div class="font-semibold">{{ team.arena.name }}</div></div>
                </section>

                <footer class="border-t border-border pt-6 text-center">
                    <router-link to="/teambuilder" class="text-primary underline-offset-4 hover:underline">Build your own all-time franchise →</router-link>
                </footer>
            </article>
        </PageShell>
    </main>
</template>
