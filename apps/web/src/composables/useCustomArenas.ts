import { ref, watch, type InjectionKey } from 'vue';
import { toast } from 'vue-sonner';
import { customArenaApi } from '@/network/api';
import { getApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { blobToBase64 } from '@/utils/avatarImage';
import type { CustomArena, CustomArenaPayload } from '@/models/api';
import type { BuilderArena } from '@/composables/useTeamPersistence';

// What the dialog hands back for each image: a new file to upload, null to
// remove the current one, or left out to keep it as it is.
export type ArenaImageChanges = Partial<Record<'photo' | 'logo' | 'drawing', Blob | null>>;

const SLOT_NAMES = { photo: 'photo', logo: 'centre logo', drawing: 'drawing' } as const;

/**
 * The live copy of the team's linked arena, from your own list. Anything
 * else (a built-in arena, someone else's from a remix, a deleted one) has
 * none, so the builder never draws a court the save would drop.
 */
export const findLiveArena = (arena: BuilderArena | null, customArenas: CustomArena[]): CustomArena | null => {
    const arenaUUID = arena && 'arenaUUID' in arena ? arena.arenaUUID : undefined;
    return arenaUUID ? (customArenas.find((a) => a.arenaUUID === arenaUUID) ?? null) : null;
};

/**
 * The signed-in user's custom arenas. The list only loads signed in (the
 * route needs a session), so a signed-out builder makes no failing call.
 * The arena is saved first and its images second, so a failed upload still
 * leaves the arena, and says so. TeamBuilder provides one instance under
 * customArenasKey, so the drawer and the court behind the starters share a
 * list and an edit shows on both without a refetch.
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

    // Returns false, after telling the user, when the image didn't go through.
    const applyImage = async (arenaUUID: string, slot: keyof ArenaImageChanges, image: Blob | null | undefined) => {
        if (image === undefined) return true;
        try {
            const response =
                image === null
                    ? await customArenaApi.deleteImage(arenaUUID, slot)
                    : await customArenaApi.uploadImage(arenaUUID, slot, await blobToBase64(image));
            if (!response.success) throw new Error(response.error);
            return true;
        } catch (err) {
            console.error(`Error saving arena ${slot}:`, err);
            toast.error(
                `The arena was saved, but its ${SLOT_NAMES[slot]} wasn't: ${getApiErrorMessage(err, 'please try again')}`,
            );
            return false;
        }
    };

    const saveArena = async (
        arenaUUID: string | null,
        data: CustomArenaPayload,
        images: ArenaImageChanges = {},
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
            const photoSaved = await applyImage(response.data.arenaUUID, 'photo', images.photo);
            const logoSaved = await applyImage(response.data.arenaUUID, 'logo', images.logo);
            const drawingSaved = await applyImage(response.data.arenaUUID, 'drawing', images.drawing);
            await fetchCustomArenas();
            if (photoSaved && logoSaved && drawingSaved) toast.success(`${arenaUUID ? 'Updated' : 'Created'} ${data.name}`);
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

export const customArenasKey: InjectionKey<ReturnType<typeof useCustomArenas>> = Symbol('customArenas');
