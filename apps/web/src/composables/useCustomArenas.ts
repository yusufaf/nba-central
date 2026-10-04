import { ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { customArenaApi } from '@/network/api';
import { getApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { blobToBase64 } from '@/utils/avatarImage';
import type { CustomArena, CustomArenaPayload } from '@/models/api';

// What the dialog hands back for the photo: a new JPEG to upload, null to
// remove the current one, or undefined to leave it as it is.
export type ArenaPhotoChange = Blob | null | undefined;

/**
 * The signed-in user's custom arenas. The list only loads signed in (the
 * route needs a session), so a signed-out builder makes no failing call.
 * The arena is saved first and the photo second, so a failed upload still
 * leaves the arena, and says so.
 */
export function useCustomArenas() {
    const { currentUser } = useCurrentUser();
    const customArenas = ref<CustomArena[]>([]);
    const loading = ref(false);

    const fetchCustomArenas = async () => {
        loading.value = true;
        try {
            const response = await customArenaApi.list();
            if (response.success) {
                customArenas.value = response.data.customArenas;
            } else {
                toast.error(response.error || 'Failed to load your arenas');
            }
        } catch (err) {
            console.error('Error fetching custom arenas:', err);
            toast.error(getApiErrorMessage(err, 'Failed to load your arenas'));
        } finally {
            loading.value = false;
        }
    };

    watch(
        () => currentUser.value?.id,
        (userId) => {
            if (userId) void fetchCustomArenas();
            else customArenas.value = [];
        },
        { immediate: true },
    );

    // Returns false, after telling the user, when the photo didn't go through.
    const applyPhoto = async (arenaUUID: string, photo: ArenaPhotoChange): Promise<boolean> => {
        if (photo === undefined) return true;
        try {
            const response =
                photo === null
                    ? await customArenaApi.deleteImage(arenaUUID, 'photo')
                    : await customArenaApi.uploadImage(arenaUUID, 'photo', await blobToBase64(photo));
            if (!response.success) throw new Error(response.error);
            return true;
        } catch (err) {
            console.error('Error saving arena photo:', err);
            toast.error(`The arena was saved, but its photo wasn't: ${getApiErrorMessage(err, 'please try again')}`);
            return false;
        }
    };

    const saveArena = async (
        arenaUUID: string | null,
        data: CustomArenaPayload,
        photo: ArenaPhotoChange,
    ): Promise<CustomArena | null> => {
        loading.value = true;
        try {
            const response = arenaUUID
                ? await customArenaApi.update(arenaUUID, data)
                : await customArenaApi.create(data);
            if (!response.success) {
                toast.error(response.error || 'Failed to save the arena');
                return null;
            }
            const photoSaved = await applyPhoto(response.data.arenaUUID, photo);
            await fetchCustomArenas();
            if (photoSaved) toast.success(`${arenaUUID ? 'Updated' : 'Created'} ${data.name}`);
            return customArenas.value.find((a) => a.arenaUUID === response.data.arenaUUID) ?? response.data;
        } catch (err) {
            console.error('Error saving arena:', err);
            toast.error(getApiErrorMessage(err, 'Failed to save the arena'));
            return null;
        } finally {
            loading.value = false;
        }
    };

    const deleteArena = async (arena: CustomArena): Promise<boolean> => {
        loading.value = true;
        try {
            const response = await customArenaApi.delete(arena.arenaUUID);
            if (!response.success) {
                toast.error(response.error || 'Failed to delete the arena');
                return false;
            }
            customArenas.value = customArenas.value.filter((a) => a.arenaUUID !== arena.arenaUUID);
            toast.success(`Deleted ${arena.name}`);
            return true;
        } catch (err) {
            console.error('Error deleting arena:', err);
            toast.error(getApiErrorMessage(err, 'Failed to delete the arena'));
            return false;
        } finally {
            loading.value = false;
        }
    };

    return { customArenas, loading, fetchCustomArenas, saveArena, deleteArena };
}
