import { ref, computed, onMounted, onUnmounted } from 'vue';
import { toast } from 'vue-sonner';
import { ESPN_GAME_SUMMARY_URL } from '@/constants/constants';
import type { ESPNGameSummary } from '@/models/types';

const CACHE_DURATION_LIVE = 30 * 1000; // 30 seconds for live games
const CACHE_DURATION_FINAL = 24 * 60 * 60 * 1000; // 24 hours for completed games
const AUTO_REFRESH_INTERVAL = 30 * 1000; // 30 seconds

interface CachedGameData {
    data: ESPNGameSummary;
    timestamp: number;
    isLive: boolean;
}

export function useGameSummary(gameId: string) {
    const gameSummary = ref<ESPNGameSummary | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    let refreshInterval: number | null = null;

    // Check if game is live/in-progress
    const isLive = computed(() => {
        if (!gameSummary.value?.header?.competitions?.[0]?.status) return false;
        const status = gameSummary.value.header.competitions[0].status;
        return status.type.state === 'in' || !status.type.completed;
    });

    // Get cache key for this game
    const getCacheKey = () => `game-summary-${gameId}`;

    // Get cached data if valid
    const getCachedData = (): ESPNGameSummary | null => {
        try {
            const cached = sessionStorage.getItem(getCacheKey());
            if (!cached) return null;

            const { data, timestamp, isLive: cachedIsLive }: CachedGameData = JSON.parse(cached);
            const now = Date.now();
            const cacheDuration = cachedIsLive ? CACHE_DURATION_LIVE : CACHE_DURATION_FINAL;

            if (now - timestamp < cacheDuration) {
                return data;
            }

            // Cache expired, remove it
            sessionStorage.removeItem(getCacheKey());
            return null;
        } catch (err) {
            console.error('Error reading cache:', err);
            return null;
        }
    };

    // Save data to cache
    const setCachedData = (data: ESPNGameSummary, isGameLive: boolean) => {
        try {
            const cacheData: CachedGameData = {
                data,
                timestamp: Date.now(),
                isLive: isGameLive,
            };
            sessionStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
        } catch (err) {
            console.error('Error saving to cache:', err);
        }
    };

    // Fetch game summary from ESPN API
    const fetchGameSummary = async (showLoadingState = true) => {
        if (showLoadingState) {
            loading.value = true;
        }
        error.value = null;

        try {
            // Try cache first
            const cached = getCachedData();
            if (cached) {
                gameSummary.value = cached;
                loading.value = false;
                return cached;
            }

            // Fetch from API
            const url = `${ESPN_GAME_SUMMARY_URL}?event=${gameId}`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Game not found or not yet available');
                }
                throw new Error(`Failed to fetch game data: ${response.statusText}`);
            }

            const data: ESPNGameSummary = await response.json();
            gameSummary.value = data;

            // Determine if game is live for caching
            const gameIsLive = data.header?.competitions?.[0]?.status?.type?.state === 'in' ||
                               !data.header?.competitions?.[0]?.status?.type?.completed;

            // Cache the data
            setCachedData(data, gameIsLive);

            return data;
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch game summary';
            toast.error(error.value ?? 'An error occurred');
            console.error('Error fetching game summary:', err);
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
        if (isLive.value) {
            startAutoRefresh();
        }
    });

    // Cleanup on unmount
    onUnmounted(() => {
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
