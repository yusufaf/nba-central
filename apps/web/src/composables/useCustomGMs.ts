import { ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { customGMApi } from '@/network/api';
import { getApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useCurrentUser } from '@/composables/useCurrentUser';
import type { GM } from '@/models/types';

export function useCustomGMs() {
    const { currentUser } = useCurrentUser();
    const customGMs = ref<GM[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const fetchCustomGMs = async () => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customGMApi.list();
            if (response.success) {
                customGMs.value = response.data.customGMs || [];
            } else {
                error.value = response.error || 'Failed to fetch custom GMs';
                toast.error(error.value ?? 'An error occurred');
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch custom GMs';
            toast.error('Failed to load custom GMs');
            console.error('Error fetching custom GMs:', err);
        } finally {
            loading.value = false;
        }
    };

    const createGM = async (data: { name: string; teams: string[] }) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customGMApi.create(data);
            if (response.success) {
                await fetchCustomGMs();
                toast.success(`Created ${data.name}`);
                return response.data;
            } else {
                error.value = response.error || 'Failed to create GM';
                toast.error(error.value ?? 'An error occurred');
                return null;
            }
        } catch (err: any) {
            const message = getApiErrorMessage(err, 'Failed to create GM');
            error.value = message;
            toast.error(message);
            console.error('Error creating GM:', err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    const updateGM = async (gmUUID: string, data: { name: string; teams: string[] }) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customGMApi.update(gmUUID, data);
            if (response.success) {
                await fetchCustomGMs();
                toast.success(`Updated ${data.name}`);
                return response.data;
            } else {
                error.value = response.error || 'Failed to update GM';
                toast.error(error.value ?? 'An error occurred');
                return null;
            }
        } catch (err: any) {
            const message = getApiErrorMessage(err, 'Failed to update GM');
            error.value = message;
            toast.error(message);
            console.error('Error updating GM:', err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    const deleteGM = async (gmUUID: string, gmName: string) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customGMApi.delete(gmUUID);
            if (response.success) {
                await fetchCustomGMs();
                toast.success(`Deleted ${gmName}`);
                return true;
            } else {
                error.value = response.error || 'Failed to delete GM';
                toast.error(error.value ?? 'An error occurred');
                return false;
            }
        } catch (err: any) {
            const message = getApiErrorMessage(err, 'Failed to delete GM');
            error.value = message;
            toast.error(message);
            console.error('Error deleting GM:', err);
            return false;
        } finally {
            loading.value = false;
        }
    };

    // Only signed in: a visitor with no account would get a 401 and a toast.
    // The session loads after mount, so this waits for it rather than
    // checking once.
    watch(
        () => currentUser.value?.id,
        (userId) => {
            if (userId) void fetchCustomGMs();
            else customGMs.value = [];
        },
        { immediate: true },
    );

    return {
        customGMs,
        loading,
        error,
        fetchCustomGMs,
        createGM,
        updateGM,
        deleteGM,
    };
}
