import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { customGMApi } from '@/network/api';
import type { GM } from '@/models/types';

export function useCustomGMs() {
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
                toast.error(error.value);
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
                toast.error(error.value);
                return null;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to create GM';
            toast.error('Failed to create GM');
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
                toast.error(error.value);
                return null;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to update GM';
            toast.error('Failed to update GM');
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
                toast.error(error.value);
                return false;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to delete GM';
            toast.error('Failed to delete GM');
            console.error('Error deleting GM:', err);
            return false;
        } finally {
            loading.value = false;
        }
    };

    onMounted(() => {
        fetchCustomGMs();
    });

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
