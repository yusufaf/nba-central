import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { customPlayerApi } from '@/network/api';
import type { Player } from '@/models/types';

export function useCustomPlayers() {
    const customPlayers = ref<Player[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const fetchCustomPlayers = async () => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customPlayerApi.list();
            if (response.success) {
                customPlayers.value = response.data.customPlayers || [];
            } else {
                error.value = response.error || 'Failed to fetch custom players';
                toast.error(error.value);
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch custom players';
            toast.error('Failed to load custom players');
            console.error('Error fetching custom players:', err);
        } finally {
            loading.value = false;
        }
    };

    const createPlayer = async (data: {
        name: string;
        position: string;
        heightFeet: number;
        heightInches: number;
        weightPounds: number;
        overallRating: number;
    }) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customPlayerApi.create(data);
            if (response.success) {
                await fetchCustomPlayers();
                toast.success(`Created ${data.name}`);
                return response.data;
            } else {
                error.value = response.error || 'Failed to create player';
                toast.error(error.value);
                return null;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to create player';
            toast.error('Failed to create player');
            console.error('Error creating player:', err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    const updatePlayer = async (playerUUID: string, data: {
        name: string;
        position: string;
        heightFeet: number;
        heightInches: number;
        weightPounds: number;
        overallRating: number;
    }) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customPlayerApi.update(playerUUID, data);
            if (response.success) {
                await fetchCustomPlayers();
                toast.success(`Updated ${data.name}`);
                return response.data;
            } else {
                error.value = response.error || 'Failed to update player';
                toast.error(error.value);
                return null;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to update player';
            toast.error('Failed to update player');
            console.error('Error updating player:', err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    const deletePlayer = async (playerUUID: string, playerName: string) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customPlayerApi.delete(playerUUID);
            if (response.success) {
                await fetchCustomPlayers();
                toast.success(`Deleted ${playerName}`);
                return true;
            } else {
                error.value = response.error || 'Failed to delete player';
                toast.error(error.value);
                return false;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to delete player';
            toast.error('Failed to delete player');
            console.error('Error deleting player:', err);
            return false;
        } finally {
            loading.value = false;
        }
    };

    onMounted(() => {
        fetchCustomPlayers();
    });

    return {
        customPlayers,
        loading,
        error,
        fetchCustomPlayers,
        createPlayer,
        updatePlayer,
        deletePlayer,
    };
}
