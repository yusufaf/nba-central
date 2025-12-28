import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { customCoachApi } from '@/network/api';
import type { Coach } from '@/models/types';

export function useCustomCoaches() {
    const customCoaches = ref<Coach[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const fetchCustomCoaches = async () => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customCoachApi.list();
            if (response.success) {
                customCoaches.value = response.data.customCoaches || [];
            } else {
                error.value = response.error || 'Failed to fetch custom coaches';
                toast.error(error.value);
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch custom coaches';
            toast.error('Failed to load custom coaches');
            console.error('Error fetching custom coaches:', err);
        } finally {
            loading.value = false;
        }
    };

    const createCoach = async (data: { name: string; overallRating: number; specialty: string }) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customCoachApi.create(data);
            if (response.success) {
                await fetchCustomCoaches();
                toast.success(`Created ${data.name}`);
                return response.data;
            } else {
                error.value = response.error || 'Failed to create coach';
                toast.error(error.value);
                return null;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to create coach';
            toast.error('Failed to create coach');
            console.error('Error creating coach:', err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    const updateCoach = async (coachUUID: string, data: { name: string; overallRating: number; specialty: string }) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customCoachApi.update(coachUUID, data);
            if (response.success) {
                await fetchCustomCoaches();
                toast.success(`Updated ${data.name}`);
                return response.data;
            } else {
                error.value = response.error || 'Failed to update coach';
                toast.error(error.value);
                return null;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to update coach';
            toast.error('Failed to update coach');
            console.error('Error updating coach:', err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    const deleteCoach = async (coachUUID: string, coachName: string) => {
        loading.value = true;
        error.value = null;

        try {
            const response = await customCoachApi.delete(coachUUID);
            if (response.success) {
                await fetchCustomCoaches();
                toast.success(`Deleted ${coachName}`);
                return true;
            } else {
                error.value = response.error || 'Failed to delete coach';
                toast.error(error.value);
                return false;
            }
        } catch (err: any) {
            error.value = err.message || 'Failed to delete coach';
            toast.error('Failed to delete coach');
            console.error('Error deleting coach:', err);
            return false;
        } finally {
            loading.value = false;
        }
    };

    onMounted(() => {
        fetchCustomCoaches();
    });

    return {
        customCoaches,
        loading,
        error,
        fetchCustomCoaches,
        createCoach,
        updateCoach,
        deleteCoach,
    };
}
