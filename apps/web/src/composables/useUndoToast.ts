import { toast } from 'vue-sonner';
import { useTeamBuilderPreferences } from '@/composables/useTeamBuilderPreferences';

/**
 * The toast with an Undo button for one history entry. Only one stays up:
 * showing another, or dismiss(), takes the previous one down, so its Undo
 * always means "undo what this toast describes" rather than whatever happens
 * to be on top of the stack.
 */
export const useUndoToast = (onUndo: (entryId: number) => void) => {
    const { undoToastDuration } = useTeamBuilderPreferences();
    let toastId: string | number | undefined;

    const dismiss = () => {
        if (toastId !== undefined) toast.dismiss(toastId);
        toastId = undefined;
    };

    const show = (message: string, entryId: number) => {
        dismiss();
        toastId = toast.success(message, {
            // Read per toast, so a change in Settings applies to the next one.
            duration: undoToastDuration.value,
            action: {
                label: 'Undo',
                onClick: () => onUndo(entryId),
            },
        });
    };

    return { show, dismiss };
};
