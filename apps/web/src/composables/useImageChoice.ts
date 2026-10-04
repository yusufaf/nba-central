import { onBeforeUnmount, ref } from 'vue';
import { validateAvatarFile } from '@/utils/avatarImage';

/**
 * One optional image in a form (the arena photo, the centre logo): the file
 * is checked, prepared in the browser (resized), previewed from an object
 * URL, and handed back as a change. `change` is a new Blob to upload, null
 * to remove the saved image, or undefined to leave it as it is.
 */
export function useImageChoice(prepare: (file: File) => Promise<Blob>, fallbackError: string) {
    const change = ref<Blob | null | undefined>(undefined);
    const previewUrl = ref<string | null>(null);
    const error = ref<string | null>(null);
    const preparing = ref(false);
    // Bumped on every reset, so a resize that finishes after the form was
    // closed or reopened for another item is dropped, not attached to it.
    let generation = 0;

    const setPreviewUrl = (url: string | null) => {
        if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
        previewUrl.value = url;
    };

    const reset = () => {
        generation++;
        preparing.value = false;
        change.value = undefined;
        setPreviewUrl(null);
        error.value = null;
    };

    const choose = async (file: File | undefined) => {
        if (!file) return;
        error.value = validateAvatarFile(file);
        if (error.value) return;
        const current = generation;
        preparing.value = true;
        try {
            const prepared = await prepare(file);
            if (current !== generation) return;
            change.value = prepared;
            setPreviewUrl(URL.createObjectURL(prepared));
        } catch (err) {
            if (current !== generation) return;
            error.value = err instanceof Error ? err.message : fallbackError;
        } finally {
            if (current === generation) preparing.value = false;
        }
    };

    // Removing an image that was never saved just drops it. Also drops a
    // resize still running, so it can't bring the removed image back.
    const remove = (hasSaved: boolean) => {
        generation++;
        preparing.value = false;
        setPreviewUrl(null);
        change.value = hasSaved ? null : undefined;
    };

    /** What to show: the new image, the saved one, or nothing once removed. */
    const shown = (savedUrl: string | undefined) => {
        if (change.value === null) return null;
        return previewUrl.value ?? savedUrl ?? null;
    };

    onBeforeUnmount(() => setPreviewUrl(null));

    return { change, error, preparing, reset, choose, remove, shown };
}
