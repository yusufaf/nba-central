import { describe, it, expect } from "vitest";
import { createLimiter } from "@/utils/limit";

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

// Lets every pending promise callback run, including the limiter's own.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createLimiter", () => {
    it("never runs more than max tasks at once", async () => {
        const limit = createLimiter(3);
        const tasks = Array.from({ length: 13 }, () => deferred<number>());
        let active = 0;
        let peak = 0;
        let started = 0;

        const results = tasks.map((task, i) =>
            limit(async () => {
                started++;
                active++;
                peak = Math.max(peak, active);
                try {
                    await task.promise;
                    return i;
                } finally {
                    active--;
                }
            }),
        );

        await flush();
        expect(started).toBe(3);

        for (const task of tasks) {
            task.resolve(0);
            await flush();
        }

        expect(peak).toBe(3);
        expect(started).toBe(13);
        expect(await Promise.all(results)).toEqual(tasks.map((_, i) => i));
    });

    it("starts queued tasks in the order they were added", async () => {
        const limit = createLimiter(1);
        const order: number[] = [];
        const gates = [deferred<void>(), deferred<void>(), deferred<void>()];

        const results = gates.map((gate, i) =>
            limit(async () => {
                order.push(i);
                await gate.promise;
            }),
        );

        for (const gate of gates) {
            await flush();
            gate.resolve();
        }
        await Promise.all(results);

        expect(order).toEqual([0, 1, 2]);
    });

    it("frees the slot when a task rejects", async () => {
        const limit = createLimiter(1);
        const failing = deferred<void>();
        let secondStarted = false;

        const first = limit(() => failing.promise);
        const firstSettled = expect(first).rejects.toThrow("boom");
        const second = limit(async () => {
            secondStarted = true;
            return "ok";
        });

        await flush();
        expect(secondStarted).toBe(false);

        failing.reject(new Error("boom"));
        await firstSettled;

        expect(await second).toBe("ok");
        expect(secondStarted).toBe(true);
    });

    it("frees the slot when a task throws synchronously", async () => {
        const limit = createLimiter(1);

        const first = limit(() => {
            throw new Error("sync boom");
        });
        const second = limit(async () => "ok");

        await expect(first).rejects.toThrow("sync boom");
        expect(await second).toBe("ok");
    });
});
