// Runs at most `max` tasks at once; the rest wait in FIFO order.
export const createLimiter = (max: number) => {
    let active = 0;
    const queue: Array<() => void> = [];

    const release = () => {
        active--;
        queue.shift()?.();
    };

    return <T>(task: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const run = () => {
                active++;
                Promise.resolve().then(task).then(resolve, reject).finally(release);
            };
            if (active < max) run();
            else queue.push(run);
        });
};
