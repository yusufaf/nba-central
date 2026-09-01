import { ref, type Ref } from "vue";
import { useStorage } from "@vueuse/core";
import { toast } from "vue-sonner";
import type { ESPNEvent } from "@/models/types";

export interface FollowedGame {
  uid: string;
  label: string;
  awayScore: string;
  homeScore: string;
}

const STORAGE_KEY = "nba-followed-games";

const isNotificationsSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

const extractScores = (event: ESPNEvent): Omit<FollowedGame, "uid"> => {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const away = competitors.find((c) => c.homeAway === "away");
  const home = competitors.find((c) => c.homeAway === "home");
  return {
    awayScore: away?.score ?? "",
    homeScore: home?.score ?? "",
    label: `${away?.team.shortDisplayName ?? "Away"} @ ${home?.team.shortDisplayName ?? "Home"}`,
  };
};

// Module-level so every component sharing this composable sees the same
// permission state — unlike followedGames, a plain ref() has no cross-instance
// sync of its own (useStorage gets that for free via a same-page storage event).
const notificationPermission: Ref<NotificationPermission> = ref(
  isNotificationsSupported() ? Notification.permission : "denied",
);

export const useGameNotifications = () => {
  const followedGames = useStorage<Record<string, FollowedGame>>(STORAGE_KEY, {});

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isNotificationsSupported()) {
      return "denied";
    }
    if (notificationPermission.value !== "default") {
      return notificationPermission.value;
    }
    const permission = await Notification.requestPermission();
    notificationPermission.value = permission;
    return permission;
  };

  const isFollowed = (uid: string): boolean => uid in followedGames.value;

  const unfollowGame = (uid: string): void => {
    const next = { ...followedGames.value };
    delete next[uid];
    followedGames.value = next;
  };

  const followGame = async (event: ESPNEvent): Promise<void> => {
    const permission = await requestPermission();
    followedGames.value = {
      ...followedGames.value,
      [event.uid]: { uid: event.uid, ...extractScores(event) },
    };

    if (permission !== "granted") {
      toast.error(
        isNotificationsSupported()
          ? "Please update your browser permissions to allow us to send you notifications"
          : "This browser doesn't support notifications",
      );
    }
  };

  const toggleFollow = async (event: ESPNEvent): Promise<void> => {
    if (isFollowed(event.uid)) {
      unfollowGame(event.uid);
    } else {
      await followGame(event);
    }
  };

  const notifyScoreChanges = (events: ESPNEvent[]): void => {
    if (notificationPermission.value !== "granted") {
      return;
    }

    let updatedGames: Record<string, FollowedGame> | null = null;

    for (const event of events) {
      const followed = followedGames.value[event.uid];
      if (!followed) {
        continue;
      }

      const scores = extractScores(event);
      if (scores.awayScore === followed.awayScore && scores.homeScore === followed.homeScore) {
        continue;
      }

      new Notification(scores.label, {
        body: `${scores.awayScore} - ${scores.homeScore}`,
        tag: event.uid,
      });

      updatedGames ??= { ...followedGames.value };
      updatedGames[event.uid] = { uid: event.uid, ...scores };
    }

    if (updatedGames) {
      followedGames.value = updatedGames;
    }
  };

  return {
    followedGames,
    notificationPermission,
    notificationsSupported: isNotificationsSupported(),
    requestPermission,
    isFollowed,
    toggleFollow,
    unfollowGame,
    notifyScoreChanges,
  };
};
