import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';

vi.mock('vue-sonner', () => ({
    toast: { success: vi.fn(() => 'toast-1'), dismiss: vi.fn(), error: vi.fn() },
}));

import { toast } from 'vue-sonner';
import { useUndoToast } from '@/composables/useUndoToast';
import { useTeamBuilderPreferences } from '@/composables/useTeamBuilderPreferences';
import { settingsSync } from '@/composables/useSettingsSync';

type ToastOptions = { duration: number; action: { label: string; onClick: () => void } };
const lastOptions = () => vi.mocked(toast.success).mock.lastCall![1] as unknown as ToastOptions;

beforeEach(() => {
    settingsSync.stop();
    localStorage.clear();
    vi.clearAllMocks();
});

describe('useUndoToast', () => {
    it('stays up for 8 seconds by default', () => {
        useUndoToast(vi.fn()).show('Team cleared successfully', 1);
        expect(lastOptions().duration).toBe(8000);
    });

    it('uses the duration chosen in settings, read when the toast is shown', async () => {
        const { show } = useUndoToast(vi.fn());
        useTeamBuilderPreferences().preferences.value.undoToastSeconds = '30';
        // Another instance's localStorage write reaches this one a tick later.
        await nextTick();

        show('Removed LeBron James from team', 1);

        expect(lastOptions().duration).toBe(30000);
    });

    it('passes the entry it describes to Undo', () => {
        const onUndo = vi.fn();
        useUndoToast(onUndo).show('Team cleared successfully', 7);

        lastOptions().action.onClick();

        expect(lastOptions().action.label).toBe('Undo');
        expect(onUndo).toHaveBeenCalledWith(7);
    });

    it('dismisses the toast it showed, once', () => {
        const { show, dismiss } = useUndoToast(vi.fn());
        show('Team cleared successfully', 1);

        dismiss();
        dismiss();

        expect(toast.dismiss).toHaveBeenCalledTimes(1);
        expect(toast.dismiss).toHaveBeenCalledWith('toast-1');
    });
});
