import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ESPNEvent } from "@/models/types";

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

const makeEvent = (overrides: {
    uid: string;
    awayScore: string;
    homeScore: string;
}): ESPNEvent =>
    ({
        uid: overrides.uid,
        competitions: [
            {
                competitors: [
                    {
                        homeAway: "away",
                        score: overrides.awayScore,
                        team: { shortDisplayName: "Away Team" },
                    },
                    {
                        homeAway: "home",
                        score: overrides.homeScore,
                        team: { shortDisplayName: "Home Team" },
                    },
                ],
            },
        ],
    }) as unknown as ESPNEvent;

describe("useGameNotifications", () => {
    let notificationCtor: ReturnType<typeof vi.fn>;
    let useGameNotifications: typeof import("@/composables/useGameNotifications").useGameNotifications;

    beforeEach(async () => {
        localStorage.clear();
        vi.resetModules();
        notificationCtor = vi.fn();
        vi.stubGlobal(
            "Notification",
            Object.assign(notificationCtor, {
                permission: "default" as NotificationPermission,
                requestPermission: vi.fn().mockResolvedValue("granted"),
            }),
        );
        ({ useGameNotifications } = await import("@/composables/useGameNotifications"));
    });

    it("is not followed before toggling", () => {
        const { isFollowed } = useGameNotifications();
        expect(isFollowed("game-1")).toBe(false);
    });

    it("follows a game and requests permission", async () => {
        const { toggleFollow, isFollowed } = useGameNotifications();
        const event = makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" });

        await toggleFollow(event);

        expect(isFollowed("game-1")).toBe(true);
        expect(Notification.requestPermission).toHaveBeenCalled();
    });

    it("unfollows an already-followed game", async () => {
        const { toggleFollow, isFollowed } = useGameNotifications();
        const event = makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" });

        await toggleFollow(event);
        await toggleFollow(event);

        expect(isFollowed("game-1")).toBe(false);
    });

    it("fires a notification when a followed game's score changes", async () => {
        const { toggleFollow, notifyScoreChanges } = useGameNotifications();
        const initial = makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" });
        await toggleFollow(initial);

        const updated = makeEvent({ uid: "game-1", awayScore: "13", homeScore: "12" });
        notifyScoreChanges([updated]);

        expect(notificationCtor).toHaveBeenCalledTimes(1);
        expect(notificationCtor).toHaveBeenCalledWith(
            "Away Team @ Home Team",
            expect.objectContaining({ body: "13 - 12" }),
        );
    });

    it("does not fire a notification when the score is unchanged", async () => {
        const { toggleFollow, notifyScoreChanges } = useGameNotifications();
        const initial = makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" });
        await toggleFollow(initial);

        notifyScoreChanges([initial]);

        expect(notificationCtor).not.toHaveBeenCalled();
    });

    it("does not fire a notification for games that are not followed", () => {
        const { notifyScoreChanges } = useGameNotifications();
        const event = makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" });

        notifyScoreChanges([event]);

        expect(notificationCtor).not.toHaveBeenCalled();
    });

    it("shares granted permission across separate composable instances", async () => {
        const componentA = useGameNotifications();
        const componentB = useGameNotifications();
        const event = makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" });

        await componentA.toggleFollow(event);

        expect(componentB.notificationPermission.value).toBe("granted");

        const updated = makeEvent({ uid: "game-1", awayScore: "13", homeScore: "12" });
        componentB.notifyScoreChanges([updated]);

        expect(notificationCtor).toHaveBeenCalledTimes(1);
    });

    it("warns the user when they follow a game but permission is denied", async () => {
        const { toast } = await import("vue-sonner");
        (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue("denied");

        const { toggleFollow } = useGameNotifications();
        await toggleFollow(makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" }));

        expect(toast.error).toHaveBeenCalledWith(
            expect.stringContaining("browser permissions"),
        );
    });

    it("warns the user when they follow a game on an unsupported browser", async () => {
        vi.unstubAllGlobals();
        const { toast } = await import("vue-sonner");

        const { toggleFollow, isFollowed } = useGameNotifications();
        await toggleFollow(makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" }));

        expect(isFollowed("game-1")).toBe(true);
        expect(toast.error).toHaveBeenCalledWith(
            expect.stringContaining("doesn't support notifications"),
        );
    });

    it("does not fire a notification without granted permission", async () => {
        (Notification as any).permission = "default";
        (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue("denied");

        const { toggleFollow, notifyScoreChanges } = useGameNotifications();
        const initial = makeEvent({ uid: "game-1", awayScore: "10", homeScore: "12" });
        await toggleFollow(initial);

        const updated = makeEvent({ uid: "game-1", awayScore: "13", homeScore: "12" });
        notifyScoreChanges([updated]);

        expect(notificationCtor).not.toHaveBeenCalled();
    });
});
