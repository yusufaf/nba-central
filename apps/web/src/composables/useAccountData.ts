import { ref } from 'vue';
import { useLogto } from '@logto/vue';
import { accountDataApi } from '@/network/api';
import { settingsSync } from '@/composables/useSettingsSync';
import { getApiErrorMessage } from '@/composables/useApiErrorMessage';
import { PREFERENCE_SECTIONS } from '@/constants/preferences';
import { downloadBlobAsFile } from '@/utils/downloadFile';

// What the user types to enable the delete. Not their username: accounts
// made with an email alone have none.
export const DELETE_CONFIRMATION_PHRASE = 'delete my data';

export const matchesDeleteConfirmation = (typed: string) =>
    typed.trim().toLowerCase() === DELETE_CONFIRMATION_PHRASE;

// sessionStorage, like the session-expired flag: signing out leaves the page
// (Logto's end-session endpoint, then back to origin), and App.vue reads
// this on the way back in to show the confirmation page.
const DATA_DELETED_KEY = 'nba-central:data-deleted';

/** True once, on the page load that follows a successful delete. */
export function consumeDataDeletedFlag(): boolean {
    try {
        const deleted = sessionStorage.getItem(DATA_DELETED_KEY) === '1';
        if (deleted) sessionStorage.removeItem(DATA_DELETED_KEY);
        return deleted;
    } catch {
        return false;
    }
}

const setDataDeletedFlag = () => {
    try {
        sessionStorage.setItem(DATA_DELETED_KEY, '1');
    } catch {
        // Storage blocked: the sign-out still happens, only the page is lost.
    }
};

// The local copies of the synced preferences go too: they are this
// account's settings as last used signed out, and the next sign-in would
// upload them as a fresh settings item. Followed games stay; they were
// never the account's.
const clearLocalPreferences = () => {
    for (const { storageKey } of Object.values(PREFERENCE_SECTIONS)) {
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // Storage blocked: there is nothing stored to clear.
        }
    }
};

export function useAccountData() {
    const { signOut, clearAllTokens, error } = useLogto();

    const exporting = ref(false);
    const exportError = ref<string | null>(null);
    const deleting = ref(false);
    const deleteError = ref<string | null>(null);

    const exportData = async () => {
        if (exporting.value) return;
        exporting.value = true;
        exportError.value = null;
        try {
            const response = await accountDataApi.exportData();
            if (!response.success) throw new Error(response.error);
            const blob = new Blob([JSON.stringify(response.data, null, 2)], {
                type: 'application/json',
            });
            downloadBlobAsFile(blob, `nba-central-data-${response.data.exportedAt.slice(0, 10)}.json`);
        } catch (err) {
            exportError.value = getApiErrorMessage(err, 'Please try again.');
        } finally {
            exporting.value = false;
        }
    };

    const deleteData = async () => {
        if (deleting.value) return;
        deleting.value = true;
        deleteError.value = null;
        try {
            const response = await accountDataApi.deleteData();
            if (!response.success) throw new Error(response.error);
        } catch (err) {
            console.error('Failed to delete account data:', err);
            // The server deletes in an order that any retry can finish, so
            // a partial delete is safe to send again.
            deleteError.value =
                "Couldn't delete your data. Some of it may already be gone, but it's safe to try again.";
            deleting.value = false;
            return;
        }

        // Stopped first, so no pending save recreates the settings item.
        settingsSync.stop();
        clearLocalPreferences();
        setDataDeletedFlag();

        // @logto/vue reports a failed sign-out through `error` instead of
        // throwing (see useSessionExpiry). The data is gone either way, so
        // fall back to dropping the tokens here and reloading signed out.
        const errorBefore = error.value;
        await signOut(window.location.origin);
        if (error.value !== errorBefore) {
            await clearAllTokens();
            window.location.assign(window.location.origin);
        }
    };

    return { exporting, exportError, exportData, deleting, deleteError, deleteData };
}
