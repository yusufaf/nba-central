export class LimiterTimeoutError extends Error {
    constructor(ms: number) {
        super(`Task timed out after ${ms}ms`);
        this.name = "LimiterTimeoutError";
    }
}

// Runs at most `max` tasks at once; the rest wait in FIFO order. With
// `timeoutMs`, a task that hasn't settled that long after it took its slot is
// rejected with LimiterTimeoutError and its signal aborted, so a task that
// never settles can't hold the slot for good. Queued time doesn't count.
export const createLimiter = (max: number, options: { timeoutMs?: number } = {}) => {
    const { timeoutMs } = options;
    let active = 0;
    const queue: Array<() => void> = [];

    const release = () => {
        active--;
        queue.shift()?.();
    };

    return <T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const run = () => {
                active++;
                const controller = new AbortController();
                const work = Promise.resolve().then(() => task(controller.signal));
                let timer: ReturnType<typeof setTimeout> | undefined;
                const settled =
                    timeoutMs === undefined
                        ? work
                        : Promise.race([
                              work,
                              new Promise<never>((_, timeout) => {
                                  timer = setTimeout(() => {
                                      const error = new LimiterTimeoutError(timeoutMs);
                                      controller.abort(error);
                                      timeout(error);
                                  }, timeoutMs);
                              }),
                          ]);
                // Clear the timer before the caller's promise settles, so no
                // timer outlives a settled task.
                settled
                    .finally(() => clearTimeout(timer))
                    .then(resolve, reject)
                    .finally(release);
            };
            if (active < max) run();
            else queue.push(run);
        });
};
