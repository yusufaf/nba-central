import type { Router } from 'vue-router';

// Chrome, Firefox and Safari word a failed dynamic import differently; the
// last is Vite's preload helper when a view's stylesheet fails.
const CHUNK_LOAD_FAILURE =
    /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/;

export const isChunkLoadError = (error: unknown): boolean =>
    error instanceof Error && CHUNK_LOAD_FAILURE.test(error.message);

export const STALE_RELOAD_KEY = 'nba-central:stale-chunk-reload';

export interface StaleChunkDeps {
    getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
    reload: (href: string) => void;
    isOnline: () => boolean;
}

// Every global is read when a navigation fails, not when this module loads:
// a browser with site data blocked throws on any sessionStorage access.
const browserDeps: StaleChunkDeps = {
    getStorage: () => sessionStorage,
    // The failed navigation never changed the URL, so push the target first,
    // unless it is already the URL (a failed first load). reload(), not
    // assign(): under the preview's hash history the href only differs by its
    // fragment, which assign() treats as an in-page jump, and the shell is
    // served without Cache-Control, so only reload() is sure to revalidate it.
    reload: (href) => {
        if (new URL(href, location.href).href !== location.href) history.pushState(null, '', href);
        location.reload();
    },
    isOnline: () => navigator.onLine,
};

/**
 * A deploy deletes the previous build's chunks, so a tab opened before it
 * fails to load any view it hasn't visited yet. Reload once onto the page the
 * visitor asked for, which picks up the new shell and its chunks.
 */
export function reloadOnStaleChunk(router: Router, deps: StaleChunkDeps = browserDeps): void {
    // vue-router only logs a navigation error itself when nothing listens,
    // so every error this doesn't handle is logged here.
    router.onError((error, to) => {
        if (!isChunkLoadError(error) || !deps.isOnline()) {
            console.error(error);
            return;
        }
        try {
            const storage = deps.getStorage();
            // Already reloaded once with no working navigation since: the
            // chunk is really gone, and another reload would loop.
            if (storage.getItem(STALE_RELOAD_KEY) !== null) {
                console.error(error);
                return;
            }
            storage.setItem(STALE_RELOAD_KEY, '1');
        } catch {
            // Without the mark nothing would stop a reload loop.
            console.error(error);
            return;
        }
        deps.reload(router.resolve(to).href);
    });

    // The guard is cleared by a working navigation, not a timer, so a slow
    // reload can't loop. A navigation that errors never reaches afterEach.
    router.afterEach((_to, _from, failure) => {
        if (failure) return;
        try {
            deps.getStorage().removeItem(STALE_RELOAD_KEY);
        } catch {
            // Blocked storage: nothing was marked.
        }
    });
}
