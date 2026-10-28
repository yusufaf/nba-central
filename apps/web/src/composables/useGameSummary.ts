import { ref, computed, onMounted, onUnmounted } from 'vue';
import { toast } from 'vue-sonner';
import type { ESPNGameSummary } from '@/models/types';
import { GameNotFoundError, getGameSummary, LIVE_SCORES_POLL_MS } from '@/network/scores';

const AUTO_REFRESH_INTERVAL = LIVE_SCORES_POLL_MS;

export function useGameSummary(gameId: string) {
    const gameSummary = ref<ESPNGameSummary | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    let refreshInterval: number | null = null;
    // onMounted starts the refresh after an await, which can finish after
    // the viewer has left the page.
    let isUnmounted = false;

    // Check if game is live/in-progress
    const isLive = computed(() => {
        if (!gameSummary.value?.header?.competitions?.[0]?.status) return false;
        const status = gameSummary.value.header.competitions[0].status;
        return status.type.state === 'in' || !status.type.completed;
    });

    // Fetch the box score. CloudFront caches it by game state, so there is
    // no client-side cache. A failed silent refresh keeps the last good box
    // score: only a load the viewer is waiting on shows the error.
    const fetchGameSummary = async (showLoadingState = true) => {
        if (showLoadingState) {
            loading.value = true;
            error.value = null;
        }

        try {
            const data = await getGameSummary(gameId);
            gameSummary.value = data;
            return data;
        } catch (err) {
            console.error('Error fetching game summary:', err);
            if (!showLoadingState) return null;
            error.value = err instanceof GameNotFoundError
                ? 'Game not found or not yet available'
                : 'Failed to fetch game summary';
            toast.error(error.value);
            return null;
        } finally {
            if (showLoadingState) {
                loading.value = false;
            }
        }
    };

    // Start auto-refresh for live games
    const startAutoRefresh = () => {
        if (refreshInterval) return; // Already running

        refreshInterval = window.setInterval(async () => {
            if (isLive.value) {
                await fetchGameSummary(false); // Silent refresh
            } else {
                // Game ended, stop refreshing
                stopAutoRefresh();
            }
        }, AUTO_REFRESH_INTERVAL);
    };

    // Stop auto-refresh
    const stopAutoRefresh = () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    };

    // Initial fetch and setup auto-refresh
    onMounted(async () => {
        await fetchGameSummary();

        // Start auto-refresh if game is live
        if (isLive.value && !isUnmounted) {
            startAutoRefresh();
        }
    });

    // Cleanup on unmount
    onUnmounted(() => {
        isUnmounted = true;
        stopAutoRefresh();
    });

    return {
        gameSummary,
        loading,
        error,
        isLive,
        fetchGameSummary,
        startAutoRefresh,
        stopAutoRefresh,
    };
}
